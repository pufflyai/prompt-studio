import type { PGlite, Transaction } from "@electric-sql/pglite";
import { withRuntimeOperationOrigin } from "pstdio-diagnostics";
import { artifactProjectionRefusals } from "../artifact-projection-admission";
import { createDb } from "../connection.pglite";
import { unadmittedStorageOwnerFailures } from "../storage-admission";
import {
  type DatabaseWorkerMessage,
  type DatabaseWorkerRequest,
  type RemoteQueryOptions,
  readDatabaseWorkerOrigin,
  serializeDatabaseError,
} from "./protocol";

declare const self: Worker;

/**
 * Owns the live PGlite database in its own thread. PGlite executes statements and decodes results
 * synchronously, so running it here keeps the API thread free for requests, health checks and
 * cancellation while a long query or a burst of writes runs.
 */
const send = (message: DatabaseWorkerMessage) => self.postMessage(message);
const opening = new AbortController();
let database: Awaited<ReturnType<typeof createDb>> | undefined;
const transactions = new Map<number, { tx: Transaction; finish: (commit: boolean) => void }>();
let nextTransaction = 0;
let cleanupStopped = false;
const ROLLBACK = Symbol("rollback");

const queryOptions = (options: RemoteQueryOptions | undefined) => ({
  ...(options?.rowMode ? { rowMode: options.rowMode } : {}),
  ...(options?.rawTypes?.length
    ? { parsers: Object.fromEntries(options.rawTypes.map((type) => [type, (value: unknown) => value])) }
    : {}),
});

const target = (txId: number | undefined): PGlite | Transaction => {
  if (!database) throw new Error("The database is not open.");
  if (txId === undefined) return database.pglite;
  const open = transactions.get(txId);
  if (!open) throw new Error("The transaction has already ended.");
  return open.tx;
};

const reply = async (id: number, run: () => Promise<unknown>) => {
  try {
    send({ type: "reply", id, ok: true, value: await run() });
  } catch (error) {
    send({ type: "reply", id, ok: false, error: serializeDatabaseError(error) });
  }
};

const withRequestOrigin = <T>(origin: unknown, run: () => T) => {
  const restored = readDatabaseWorkerOrigin(origin);
  return restored ? withRuntimeOperationOrigin(restored, run) : run();
};

// Settles once a transaction has committed or rolled back; `end` waits for it.
const settledTransactions = new Map<number, Promise<void>>();

// The transaction stays open until the API thread ends it, so its callback waits on that message.
const begin = (id: number) => {
  if (!database) {
    send({ type: "reply", id, ok: false, error: serializeDatabaseError(new Error("The database is not open.")) });
    return;
  }
  const txId = nextTransaction++;
  let started = false;
  const settled = database.pglite
    .transaction(async (tx) => {
      started = true;
      const commit = await new Promise<boolean>((finish) => {
        transactions.set(txId, { tx, finish });
        send({ type: "reply", id, ok: true, value: txId });
      });
      transactions.delete(txId);
      if (!commit) throw ROLLBACK;
    })
    .then(
      () => {},
      (error) => {
        if (error !== ROLLBACK) throw error;
      },
    );
  settledTransactions.set(txId, settled);
  settled.catch((error) => {
    settledTransactions.delete(txId);
    // A transaction that never started answers its begin request; a later failure answers `end`.
    if (!started) send({ type: "reply", id, ok: false, error: serializeDatabaseError(error) });
  });
};

const handle = (request: DatabaseWorkerRequest) => {
  switch (request.type) {
    case "open":
      void createDb({
        ...request.options,
        signal: opening.signal,
        onPhase: (phase) => send({ type: "phase", phase }),
        onLegacyConversionError: request.reportLegacyConversionErrors
          ? ({ owner, backupPath, error }) =>
              send({ type: "legacy-conversion-failed", owner, backupPath, error: serializeDatabaseError(error) })
          : undefined,
      }).then(
        (opened) => {
          database = opened;
          send({
            type: "opened",
            path: opened.path,
            unadmittedOwners: unadmittedStorageOwnerFailures(opened.db).map(({ owner, cause }) => ({
              owner,
              cause: serializeDatabaseError(cause),
            })),
            projectionRefusals: artifactProjectionRefusals(opened.db),
          });
        },
        (error) => send({ type: "open-failed", error: serializeDatabaseError(error) }),
      );
      return;
    case "abort":
      opening.abort(new Error("Opening the database was cancelled."));
      return;
    case "query":
      void reply(request.id, () =>
        withRequestOrigin(request.origin, () =>
          target(request.txId).query(request.sql, request.params, queryOptions(request.options)),
        ),
      );
      return;
    case "exec":
      void reply(request.id, () => withRequestOrigin(request.origin, () => target(request.txId).exec(request.sql)));
      return;
    case "begin":
      withRequestOrigin(request.origin, () => begin(request.id));
      return;
    case "end":
      void reply(request.id, async () => {
        const open = transactions.get(request.txId);
        if (!open) throw new Error("The transaction has already ended.");
        const settled = settledTransactions.get(request.txId);
        open.finish(request.commit);
        try {
          await settled;
        } finally {
          settledTransactions.delete(request.txId);
        }
      });
      return;
    case "cleanup":
      cleanupStopped = false;
      void reply(request.id, async () => {
        if (!database) throw new Error("The database is not open.");
        await database.cleanupRetiredRows(() => cleanupStopped);
      });
      return;
    case "stop-cleanup":
      cleanupStopped = true;
      return;
    case "close":
      void reply(request.id, async () => {
        await database?.close();
        database = undefined;
      });
      return;
  }
};

self.onmessage = (event: MessageEvent<DatabaseWorkerRequest>) => handle(event.data);
