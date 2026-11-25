import { AsyncLocalStorage } from "node:async_hooks";
import type { DbClient } from "../../db/connection.pglite";
import { createDocumentFiles, flushDocumentDirectories } from "./document-files";

type FileContext = Pick<DbClient, "transaction">;
const attached = new WeakMap<object, ReturnType<typeof createDocumentFiles>>();
const transactions = new WeakSet<object>();
type Changes = Map<string, Set<number>>;
const changed = new WeakMap<object, Changes>();
const collectors = new WeakMap<object, (projectId: string, ids: number[]) => Promise<void>>();
export const attachDocumentCollector = (db: DbClient, collect: (projectId: string, ids: number[]) => Promise<void>) =>
  collectors.set(db, collect);
export const trackDocumentFiles = (client: object, projectId: string, id: number) => {
  const pending = changed.get(client);
  if (!pending) throw new Error("Document file writes require a transaction");
  let ids = pending.get(projectId);
  if (!ids) {
    ids = new Set();
    pending.set(projectId, ids);
  }
  ids.add(id);
};
const publications = new WeakMap<object, () => Promise<void>>();
type Files = ReturnType<typeof createDocumentFiles>;
type Batch = <T>(tasks: ((files: Files) => Promise<T>)[]) => Promise<T[]>;
const batches = new WeakMap<object, Batch>();
const batchContext = new AsyncLocalStorage<Files>();
const fileRoots = new WeakMap<Files, Files>();
const rejectBatchReentry = (files: Files) => {
  if (batchContext.getStore() === (fileRoots.get(files) ?? files))
    throw new Error("Document file batch tasks must use their supplied writer without nested transactions");
};
const runFileBatch = async <T>(
  files: Files,
  tasks: ((files: Files) => Promise<T>)[],
  durable: Set<string>,
  pending: Set<string>,
) => {
  const values: T[] = [];
  const errors: unknown[] = [];
  const writes: Promise<void>[] = [];
  let active = true;
  const write = <Result>(run: () => Promise<Result>) => {
    if (!active) throw new Error("Document file batch writer has expired");
    const result = run();
    writes.push(
      result.then(
        () => undefined,
        (error) => {
          errors.push(error);
        },
      ),
    );
    return result;
  };
  const writer: Files = {
    ...files,
    put: (project, id, kind, bytes) => write(() => files.put(project, id, kind, bytes, durable, pending)),
    writeHead: (project, id, head) => write(() => files.writeHead(project, id, head, durable, pending)),
  };
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(8, tasks.length) }, async () => {
      while (next < tasks.length) {
        const index = next++;
        try {
          values[index] = await tasks[index]!(writer);
        } catch (error) {
          errors.push(error);
        }
      }
    }),
  );
  active = false;
  await Promise.all(writes);
  // Every creator must finish its ancestor flushes before any batch reference
  // can commit. Drain failed batches too, then make caught retries flush anew.
  if (errors.length) {
    durable.clear();
    throw errors[0];
  }
  await flushDocumentDirectories(pending, durable);
  return values;
};
const scopedFiles = (files: ReturnType<typeof createDocumentFiles>) => {
  const durable = new Set<string>();
  let publication = Promise.resolve();
  const publish = <T>(run: () => Promise<T>) => {
    rejectBatchReentry(scoped);
    const result = publication.then(run);
    // Serial publication also fences concurrent reuse of a renamed file whose
    // directory flush has not completed. A caught failure leaves retries runnable.
    publication = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  };
  const scoped = {
    ...files,
    put: (projectId: string, id: number, kind: Parameters<typeof files.put>[2], bytes: Uint8Array) => {
      const content = new Uint8Array(bytes);
      return publish(() => files.put(projectId, id, kind, content, durable));
    },
    writeHead: (projectId: string, id: number, head: Parameters<typeof files.writeHead>[2]) => {
      const captured = structuredClone(head);
      return publish(() => files.writeHead(projectId, id, captured, durable));
    },
  };
  const root = fileRoots.get(files) ?? files;
  fileRoots.set(scoped, root);
  batches.set(scoped, (tasks) =>
    publish(() => {
      const pending = new Set<string>();
      return batchContext.run(root, () => runFileBatch(files, [...tasks], durable, pending));
    }),
  );
  publications.set(scoped, () => publication);
  return scoped;
};
const bindTransactions = (client: FileContext, files: ReturnType<typeof createDocumentFiles>, inherited?: Changes) => {
  attached.set(client, files);
  if (inherited) changed.set(client, inherited);
  const transaction = client.transaction.bind(client);
  // Transaction-only helpers inherit this database's store explicitly through
  // their client lifetime, including savepoints; they never resolve a live home.
  client.transaction = (async (run, config) => {
    rejectBatchReentry(files);
    const pending = inherited ?? new Map<string, Set<number>>();
    try {
      return await transaction(async (tx) => {
        transactions.add(tx);
        const scoped = inherited ? files : scopedFiles(files);
        bindTransactions(tx, scoped, pending);
        try {
          return await run(tx);
        } finally {
          await publications.get(scoped)?.();
        }
      }, config);
    } finally {
      const collect = !inherited && collectors.get(client);
      if (collect)
        for (const [projectId, ids] of pending) {
          try {
            await collect(projectId, [...ids]);
          } catch (error) {
            console.warn("Document file cleanup will resume at startup", error);
          }
        }
    }
  }) as typeof client.transaction;
};
/** Additional database handles on the same engine share the existing file authority. */
export const attachDocumentFiles = (db: object, files: ReturnType<typeof createDocumentFiles>) => {
  if (attached.get(db) === files) return;
  if (attached.has(db)) throw new Error("Document files are already attached to this database");
  bindTransactions(db as FileContext, files);
};
export const documentFilesFor = (db: object, database?: string) => {
  let files = attached.get(db);
  if (!files && database !== undefined) {
    files = createDocumentFiles(database === ":memory:" ? undefined : `${database}-documents`);
    bindTransactions(db as FileContext, files);
  }
  if (!files) throw new Error("Document files are not attached to this database");
  return files;
};

type Transaction = Parameters<Parameters<DbClient["transaction"]>[0]>[0];
/** Root reads join the same queue as writes/collection; existing transactions keep their lifetime. */
export const withDocumentFileTransaction = <T>(client: object, run: (tx: Transaction) => Promise<T>) =>
  transactions.has(client) ? run(client as Transaction) : (client as DbClient).transaction(run);

/** One transaction publication fence for independent, bounded restore work.
 * Tasks use this writer directly; nested publication batches are not permitted. */
export const withDocumentFileBatch = <T>(files: Files, tasks: ((files: Files) => Promise<T>)[]) => {
  const batch = batches.get(files);
  if (!batch) throw new Error("Document file batches require a transaction");
  return batch(tasks);
};
