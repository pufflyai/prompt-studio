import {
  acceptPreparedRevision,
  createPreparationScope,
  preparedRevisionState,
  readAcceptedRevision,
} from "pstdio-extensions";
import type { LoadedExtensionSnapshot } from "./extension-runtime";
import type { createBuildReporters } from "./extension-webview-build-reporters";
import { expectedWebviewBuildSource, type InstalledSourceWithManifest } from "./extension-webview-build-runner";
import { type CheckOwner, joinPreparationDependencies } from "./pending-webview-checks";
import { validateExtensionWebviews } from "./validate-extension-webviews";

// Initial raw-source enablement has accepted runtime callbacks but no frontend set yet.
// Complete that set with the same batch used by installation. Later checks keep the
// same batch identity instead of rebuilding unchanged siblings with singleton identities.
type InitialWebviewInput = {
  current: { row: InstalledSourceWithManifest; snapshot: LoadedExtensionSnapshot };
  loadCurrent: () => Promise<{ row: InstalledSourceWithManifest; snapshot: LoadedExtensionSnapshot } | null>;
  reportResult: ReturnType<typeof createBuildReporters>["reportResult"];
  retirePriorAttempts: () => void;
  signal: AbortSignal;
};
const complete = async (input: InitialWebviewInput) => {
  const { row, snapshot } = input.current;
  const previous = await readAcceptedRevision(row.source_path);
  if (!previous || previous.id !== snapshot.loaded.preparedRevision?.id) return false;
  input.retirePriorAttempts();
  // A handled check may retain its previous complete output after a rejected candidate.
  const retained = previous.webviews !== undefined;
  const reportFailure = async (error: unknown) => {
    input.signal.throwIfAborted();
    if (retained)
      await reportViews(
        input,
        Object.keys(previous.webviews!).map((id) => [
          id,
          { status: "failure", error: error instanceof Error ? error : new Error(String(error)) },
        ]),
      );
    input.signal.throwIfAborted();
    return retained;
  };
  const loaded = { ...snapshot.loaded, preparedRevision: { ...previous } };
  try {
    await validateExtensionWebviews(loaded, row.source_path, row.install_name, input.signal);
  } catch (error) {
    // Initial failures use per-view feedback; a rejected update retains its complete set.
    return reportFailure(error);
  }
  if (retained && preparedRevisionState(previous) === preparedRevisionState(loaded.preparedRevision)) {
    const current = await input.loadCurrent();
    input.signal.throwIfAborted();
    if (!isSameSource(input, current)) return retained;
    return true;
  }
  if (
    !(await reportViews(
      input,
      Object.entries(loaded.preparedRevision.webviews!).map(([id, artifact]) => [id, { status: "success", artifact }]),
    ))
  )
    return retained;
  input.signal.throwIfAborted();
  // Reporting may await database ownership. Reinspect the whole set afterwards so an
  // external dependency edit during that wait cannot complete the earlier identity.
  const state = preparedRevisionState(loaded.preparedRevision);
  try {
    await validateExtensionWebviews(loaded, row.source_path, row.install_name, input.signal);
  } catch (error) {
    return reportFailure(error);
  }
  const current = await input.loadCurrent();
  input.signal.throwIfAborted();
  if (preparedRevisionState(loaded.preparedRevision) !== state || !isSameSource(input, current))
    return reportFailure(new Error("Extension webviews changed while recording their build results."));
  await acceptPreparedRevision(row.source_path, loaded.preparedRevision, {
    expectedState: preparedRevisionState(previous),
    signal: input.signal,
  });
  return true;
};

const isSameSource = (
  input: Pick<InitialWebviewInput, "current">,
  current: Awaited<ReturnType<InitialWebviewInput["loadCurrent"]>>,
) =>
  current?.row.source_path === input.current.row.source_path &&
  current.row.source_hash === input.current.row.source_hash &&
  current.snapshot.loaded.preparedRevision?.id === input.current.snapshot.loaded.preparedRevision?.id &&
  current.snapshot.loadKey === input.current.snapshot.loadKey;
const reportViews = async (
  input: InitialWebviewInput,
  results: [string, Parameters<InitialWebviewInput["reportResult"]>[2]][],
) => {
  const { row } = input.current;
  for (const [id, result] of results) {
    while (!input.signal.aborted) {
      const current = await input.loadCurrent();
      input.signal.throwIfAborted();
      if (!isSameSource(input, current)) return false;
      const outcome = await input.reportResult(row.id, id, result, expectedWebviewBuildSource(current!.row));
      input.signal.throwIfAborted();
      if (outcome === "failed") throw new Error(`Could not record webview build result: ${id}`);
      if (outcome === "obsolete") return false;
      if (outcome === "reported") break;
    }
  }
  return true;
};

export const completeInitialWebviews = async (
  input: Omit<InitialWebviewInput, "signal"> & { activeBuilds: Set<AbortController> },
) => {
  const controller = new AbortController();
  input.activeBuilds.add(controller);
  try {
    return await complete({ ...input, signal: controller.signal });
  } finally {
    input.activeBuilds.delete(controller);
  }
};

export const createInitialWebviewCompletion = (activeBuilds: Set<AbortController>) => {
  type Result = { current: InitialWebviewInput["current"] | null; handled: boolean; retry?: boolean };
  type Job = CheckOwner & { started: boolean; owners: CheckOwner[]; work: Promise<Result> };
  const running = new Map<string, Job>();
  const enqueue = (input: Omit<InitialWebviewInput, "signal">) => {
    const caller = createPreparationScope();
    const key = `${input.current.row.source_path}\0${input.current.snapshot.loadKey}`;
    let job = running.get(key);
    if (!job || job.started) {
      const previous = job;
      let created: Job;
      const run = () =>
        caller.run(async () => {
          created.started = true;
          const current = await input.loadCurrent();
          if (!current) return { current: null, handled: false };
          // Release the old admission before joining another key. Holding both
          // could deadlock during A → B → A source changes.
          if (!isSameSource(input, current)) return { current, handled: false, retry: true };
          const handled = await completeInitialWebviews({ ...input, current, activeBuilds });
          const latest = await input.loadCurrent();
          return { current: latest, handled, retry: latest !== null && !isSameSource(input, latest) };
        });
      // A later freshness check must run after the active validation. Callers can
      // share an unstarted continuation, whose inputs are loaded only when it runs.
      const work = (previous ? previous.work.then(run, run) : Promise.resolve().then(run)).finally(() => {
        created.settled = true;
        if (running.get(key) === created) running.delete(key);
        caller.dispose();
      });
      created = {
        scope: caller,
        work,
        started: false,
        settled: false,
        owners: previous?.owners.filter((owner) => !owner.settled) ?? [],
      };
      created.owners.push(created);
      job = created;
      running.set(key, job);
    }
    if (caller === job.scope)
      return joinPreparationDependencies(
        caller,
        job.owners.filter((owner) => owner !== job),
        job.work,
      );
    return joinPreparationDependencies(caller, job.owners, job.work).finally(() => caller.dispose());
  };
  return async (input: Omit<InitialWebviewInput, "signal">) => {
    let current = input.current;
    while (true) {
      const result = await enqueue({ ...input, current });
      if (!result.retry || !result.current) return result;
      current = result.current;
    }
  };
};
