import { expect, test } from "bun:test";
import { sql } from "drizzle-orm";
import { createAssetDatabase } from "./database";

interface ForwardedConnection {
  upstream?: Bun.Socket<undefined>;
  pending: Uint8Array[];
}

test("a failed initial listener connection can retry without replacing the asset owner", async () => {
  const target = new URL(process.env.SYNC_TEST_DATABASE_URL!);
  let first = true;
  let failures = 0;
  const proxy = Bun.listen<ForwardedConnection>({
    hostname: "127.0.0.1",
    port: 0,
    socket: {
      async open(front) {
        front.data = { pending: [] };
        if (first) {
          first = false;
          front.end();
          return;
        }
        const upstream = await Bun.connect<undefined>({
          hostname: target.hostname,
          port: Number(target.port) || 5432,
          socket: {
            data: (_socket, bytes) => {
              front.write(bytes);
            },
            close: () => {
              front.end();
            },
            error: () => {
              front.end();
            },
          },
        });
        front.data.upstream = upstream;
        for (const bytes of front.data.pending) upstream.write(bytes);
        front.data.pending = [];
      },
      data(front, bytes) {
        if (front.data.upstream) front.data.upstream.write(bytes);
        else front.data.pending.push(Uint8Array.from(bytes));
      },
      close: (front) => {
        front.data?.upstream?.end();
      },
      error: (front) => {
        front.data?.upstream?.end();
      },
    },
  });
  const address = new URL(target);
  address.hostname = proxy.hostname;
  address.port = String(proxy.port);
  const database = createAssetDatabase(
    address.href,
    () => {},
    () => {
      failures++;
    },
  );
  try {
    const failure = await database.ready().then(
      () => null,
      (error: unknown) => error,
    );
    expect(failure).toBeInstanceOf(Error);
    await Promise.all([database.ready(), database.ready(), database.ready()]);
    const result = await database.run(
      (connection) => connection.execute(sql`SELECT 1 AS healthy`),
      new AbortController().signal,
    );
    expect(result.rows).toEqual([{ healthy: 1 }]);
    const listeners = await database.run(
      (connection) =>
        connection.execute(
          sql`SELECT count(*)::integer AS count FROM pg_stat_activity WHERE datname = current_database() AND query = 'LISTEN relay_asset_cancel'`,
        ),
      new AbortController().signal,
    );
    expect(listeners.rows).toEqual([{ count: 1 }]);
    expect(failures).toBe(1);
  } finally {
    await database.close();
    proxy.stop(true);
  }
});
