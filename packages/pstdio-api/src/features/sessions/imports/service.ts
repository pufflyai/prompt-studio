import type { SessionImportJob, SessionImportSource } from "pstdio-api-contracts";
import { importHistoricalSession, type SessionImportDeps } from "./import-session";
import { importRowError, parseImportRow, type SessionImportRow } from "./inspect-row";
import { createSessionImportJobStore } from "./job-store";
import { previewSessionImport } from "./preview";
import { jsonLines, locateSessionImportSource, openSessionImportSource, SessionImportError } from "./source";

const message = (error: unknown) => (error instanceof Error ? error.message : String(error));
const counts = () => ({ processed: 0, imported: 0, skipped: 0, failed: 0, excluded: 0, cursor: 0 });
export const createSessionImportService = (deps: SessionImportDeps, directory: string) => {
  const store = createSessionImportJobStore(directory);
  const active = new Map<string, { stop: boolean; abort: AbortController; done: Promise<void> }>();
  let closed = false;
  let preparation: Promise<unknown> | undefined;
  let preparingId: string | undefined;
  const pauseRequests = new Set<string>();
  const checkCapacity = () => {
    if (closed || active.size) throw new SessionImportError("Another import is running or the host is closing.", 409);
  };
  const prepare = <T>(operation: () => Promise<T>, id?: string) => {
    if (preparation) throw new SessionImportError("Another import is being prepared.", 409);
    checkCapacity();
    preparingId = id;
    const pending = operation();
    preparation = pending;
    return pending.finally(() => {
      if (preparation === pending) {
        preparation = undefined;
        preparingId = undefined;
      }
    });
  };
  const validateMap = async (projectMap: Record<string, string>) => {
    if (!Object.keys(projectMap).length)
      throw new SessionImportError("Provide projectMap entries to select source projects and their destinations.");
    for (const projectId of new Set(Object.values(projectMap))) {
      if (!(await deps.projectService.get(projectId)))
        throw new SessionImportError(`Destination project not found: ${projectId}`);
    }
  };
  const get = async (id: string) => {
    const job = await store.read(id);
    // An interrupted process has no worker. Reads never rewrite a worker's checkpoint.
    if (job.status === "running" && !active.has(id) && preparingId !== id) job.status = "paused";
    return job;
  };
  const recoverStage = async (jobId: string) => {
    const stage = await store.readStage(jobId);
    if (!stage) return;
    const session = await deps.sessionService.get(stage.sessionId);
    if (!session) for (const id of stage.files) await deps.fileService.discardUpload(stage.projectId, id);
    await store.clearStage(jobId);
  };
  const importRow = async (
    job: SessionImportJob,
    source: Awaited<ReturnType<typeof openSessionImportSource>>,
    row: SessionImportRow,
  ) => {
    try {
      const session = parseImportRow(row);
      const projectId = job.source.projectMap[session.project_id];
      if (!projectId) job.excluded++;
      else if (
        await importHistoricalSession(deps, source, session, projectId, (stage) => store.writeStage(job.id, stage))
      )
        job.imported++;
      else job.skipped++;
    } catch (error) {
      await store.appendError(job.id, importRowError(row, error));
      job.failed++;
    } finally {
      await recoverStage(job.id);
    }
  };
  const importRows = async (
    job: SessionImportJob,
    source: Awaited<ReturnType<typeof openSessionImportSource>>,
    execution: { stop: boolean },
  ) => {
    for await (const row of jsonLines(source.sessionsPath, job.cursor)) {
      if (execution.stop) break;
      await importRow(job, source, row);
      job.processed++;
      job.cursor = row.line;
      await store.write(job);
    }
  };
  const launch = (job: SessionImportJob) => {
    const execution = { stop: false, abort: new AbortController(), done: Promise.resolve() };
    active.set(job.id, execution);
    execution.done = (async () => {
      let source: Awaited<ReturnType<typeof openSessionImportSource>> | undefined;
      try {
        await recoverStage(job.id);
        source = await openSessionImportSource(job.source, {
          signal: execution.abort.signal,
          onProgress: async (count) => {
            job.indexedFiles = count;
            await store.write(job);
          },
        });
        if (job.fingerprint && source.fingerprint !== job.fingerprint)
          throw new SessionImportError("Exported tables changed; start a new import to inspect the new source.", 409);
        job.fingerprint = source.fingerprint;
        job.phase = "importing";
        await store.write(job);
        await importRows(job, source, execution);
        job.status = execution.stop ? "paused" : "completed";
      } catch (error) {
        job.status = execution.stop ? "paused" : "failed";
        if (!execution.stop) job.error = message(error);
      } finally {
        await source?.close();
      }
      await store.write(job);
    })().finally(() => active.delete(job.id));
    void execution.done.catch(() => undefined);
    return structuredClone(job);
  };
  const begin = async (job: SessionImportJob) => {
    job.status = "running";
    job.phase = "preparing";
    job.indexedFiles = 0;
    await store.write(job);
    if (closed || pauseRequests.has(job.id)) {
      job.status = "paused";
      await store.write(job);
      return job;
    }
    return launch(job);
  };
  return {
    get,
    async preview(input: SessionImportSource, signal?: AbortSignal) {
      if (Object.keys(input.projectMap ?? {}).length) await validateMap(input.projectMap ?? {});
      return previewSessionImport(deps, input, signal);
    },
    start: (input: SessionImportSource) =>
      prepare(async () => {
        await validateMap(input.projectMap ?? {});
        const source = await locateSessionImportSource(input);
        checkCapacity();
        const timestamp = new Date().toISOString();
        const job: SessionImportJob = {
          id: crypto.randomUUID(),
          source: {
            ...input,
            sourcePath: source.sourcePath,
            storagePath: input.storagePath ? source.roots[1] : undefined,
            projectMap: input.projectMap ?? {},
          },
          fingerprint: null,
          status: "running",
          phase: "preparing",
          indexedFiles: 0,
          attempt: 1,
          ...counts(),
          createdAt: timestamp,
          updatedAt: timestamp,
        };
        await store.write(job);
        await store.resetErrors(job.id);
        return begin(job);
      }),
    async pause(id: string) {
      await get(id);
      pauseRequests.add(id);
      try {
        if (preparingId === id) await preparation?.catch(() => undefined);
        const execution = active.get(id);
        if (execution) {
          execution.stop = true;
          execution.abort.abort();
          await execution.done;
        }
        return get(id);
      } finally {
        pauseRequests.delete(id);
      }
    },
    resume: (id: string) =>
      prepare(async () => {
        const job = await get(id);
        if (job.status === "completed" && !job.failed) throw new SessionImportError("Import is already complete.", 409);
        await validateMap(job.source.projectMap);
        if (job.status === "completed") Object.assign(job, counts());
        await store.trimErrors(id, job.failed);
        job.attempt++;
        delete job.error;
        return begin(job);
      }, id),
    async errors(id: string, offset = 0, limit = 100) {
      const job = await get(id);
      return store.errors(id, offset, limit, job.failed);
    },
    async close() {
      closed = true;
      await preparation?.catch(() => undefined);
      for (const execution of active.values()) {
        execution.stop = true;
        execution.abort.abort();
      }
      await Promise.all([...active.values()].map((execution) => execution.done));
    },
  };
};
