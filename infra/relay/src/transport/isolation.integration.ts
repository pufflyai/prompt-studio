import { afterAll, beforeAll, expect, test } from "bun:test";
import { type RelayOperation, relayPath, snapshotSchema } from "pstdio-sync-contracts";
import { startRelay } from "../service";
import { sealStoredMutation } from "../storage/mutation.fixture";
import { createTransportFixture } from "./integration-fixture";
import { connectSocket } from "./socket.fixture";

const fixture = createTransportFixture();
const sealMutation = (body: Parameters<typeof sealStoredMutation>[0]) =>
  sealStoredMutation(body, fixture.relayDatabaseUrl);
beforeAll(() => fixture.initialize());
afterAll(() => fixture.close());

test("overlapping workbench, environment, record and upload IDs remain independent across accounts", async () => {
  const first = await fixture.context({ workbenchId: "same-workbench", environmentId: "same-environment" });
  const second = await fixture.context({ workbenchId: "same-workbench", environmentId: "same-environment" });
  const server = startRelay({ hostname: "127.0.0.1", port: 0 }, first);
  const call = (context: typeof first, operation: RelayOperation, body?: unknown) =>
    fetch(new URL(relayPath(context.scope, operation), server.url), {
      method: body === undefined ? "GET" : "POST",
      headers: { authorization: `Bearer ${context.token}` },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  const a = connectSocket(server.url, first.scope, first.token);
  const b = connectSocket(server.url, second.scope, second.token);
  const bytes = new TextEncoder().encode("first account bytes");
  const asset = {
    sha256: new Bun.CryptoHasher("sha256").update(bytes).digest("hex"),
    byteLength: bytes.length,
    mediaType: "application/octet-stream",
  };
  try {
    expect((await a.next()).type).toBe("ready");
    expect((await b.next()).type).toBe("ready");
    await first.assets.begin(first.scope, "same-upload", asset);
    await first.assets.writePart(first.scope, "same-upload", 1, { ...asset, body: new Blob([bytes]).stream() });
    await first.assets.finish(first.scope, "same-upload");
    await second.assets.begin(second.scope, "same-upload", asset);
    expect((await call(second, "assets/finish", { uploadId: "same-upload" })).status).toBe(409);
    expect((await call(second, "assets/read", { asset, offset: 0 })).status).toBe(404);
    expect((await call(first, "assets/read", { asset, offset: 0 })).status).toBe(200);
    for (const [context, connection] of [
      [first, a],
      [second, b],
    ] as const) {
      const mutation = await sealMutation({
        protocolVersion: 2,
        scope: context.scope,
        environmentId: context.environmentId,
        operationId: "same-operation",
        parents: [],
        changes: [{ recordId: "same-record", expectedRevision: 0, baseDeleted: false, deleted: true }],
      });
      expect((await call(context, "submit", mutation)).status).toBe(200);
      expect((await connection.next()).type).toBe("changed");
      const snapshot = snapshotSchema.parse(await (await call(context, "snapshot")).json());
      expect(snapshot.scope).toEqual(context.scope);
      expect(snapshot.receipts["same-operation"]!.mutation.fingerprint).toBe(mutation.fingerprint);
    }
    expect(a.messages).toHaveLength(2);
    expect(b.messages).toHaveLength(2);
    await first.manager.disable({ requestId: "disable", accountId: first.scope.accountId });
    await expect(first.renew()).rejects.toThrow("Environment access unavailable");
    expect(a.socket.readyState).toBe(WebSocket.OPEN);
    expect((await call(second, "snapshot")).status).toBe(200);
    expect(b.socket.readyState).toBe(WebSocket.OPEN);
  } finally {
    a.socket.close();
    b.socket.close();
    await server.stop(true);
    await first.close();
    await second.close();
  }
});
