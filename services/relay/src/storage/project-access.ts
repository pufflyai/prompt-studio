import { sql } from "drizzle-orm";
import { assertProjectActive } from "./accounts";
import type { connectRelay, RelayTransaction } from "./database";

export const projectAdvisoryKey = (key: string) => sql`hashtextextended(${`relay-project:${key}`}, 0)`;

export const tryLockProject = async (tx: RelayTransaction, projectKey: string) => {
  const lock = await tx.execute<{ acquired: boolean }>(
    sql`SELECT pg_try_advisory_xact_lock(${projectAdvisoryKey(projectKey)}) AS acquired`,
  );
  return lock.rows[0]!.acquired;
};

const releaseWithBody = (response: Response, release: () => void, signal: AbortSignal) => {
  const reader = response.body!.getReader();
  const cancelled = () => {
    void reader.cancel(signal.reason).catch(() => {});
    release();
  };
  signal.addEventListener("abort", cancelled, { once: true });
  const done = () => {
    signal.removeEventListener("abort", cancelled);
    release();
  };
  if (signal.aborted) cancelled();
  return new Response(
    new ReadableStream<Uint8Array>({
      async pull(controller) {
        try {
          const result = await reader.read();
          if (!result.done) return controller.enqueue(result.value);
          controller.close();
          done();
        } catch (error) {
          done();
          throw error;
        }
      },
      async cancel(reason) {
        try {
          await reader.cancel(reason);
        } finally {
          done();
        }
      },
    }),
    { status: response.status, headers: response.headers },
  );
};

// Use a separate connection pool so a stream holding admission never starves the storage owner
// that has to finish it. Shared admission holds until the request's work, including a download, drains.
export const createProjectAccess = (connection: ReturnType<typeof connectRelay>) => {
  const admit = async (tx: RelayTransaction, key: string) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock_shared(${projectAdvisoryKey(key)})`);
    await assertProjectActive(tx, key);
  };
  return {
    write: <T>(key: string, handle: () => Promise<T>, signal?: AbortSignal) =>
      connection.run((db) =>
        db.transaction(async (tx) => {
          await admit(tx, key);
          signal?.throwIfAborted();
          return handle();
        }),
      ),
    async response(key: string, signal: AbortSignal, handle: () => Promise<Response | undefined>) {
      const result = Promise.withResolvers<Response | undefined>();
      const released = Promise.withResolvers<void>();
      const serve = async (tx: RelayTransaction) => {
        await admit(tx, key);
        signal.throwIfAborted();
        const response = await handle();
        if (!response?.body || response.headers.get("content-type") !== "application/octet-stream") {
          result.resolve(response);
          return;
        }
        result.resolve(releaseWithBody(response, released.resolve, signal));
        await released.promise;
      };
      void connection.run((db) => db.transaction(serve)).catch(result.reject);
      return result.promise;
    },
  };
};
