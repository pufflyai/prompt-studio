import {
  acceptPreparedRevision,
  createPreparationScope,
  preparedRevisionState,
  readAcceptedRevision,
} from "pstdio-extensions";
import type { LoadedExtensionSnapshot } from "./extension-runtime";
import type { createBuildReporters } from "./extension-webview-build-reporters";
import { expectedWebviewBuildSource, type InstalledSourceWithManifest } from "./extension-webview-build-runner";
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
  if (preparedRevisionState(previous) === preparedRevisionState(loaded.preparedRevision)) {
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

const isSameSource = (input: InitialWebviewInput, current: Awaited<ReturnType<InitialWebviewInput["loadCurrent"]>>) =>
  current?.row.source_path === input.current.row.source_path &&
  current.row.source_hash === input.current.row.source_hash &&
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
  const running = new Map<string, { scope: ReturnType<typeof createPreparationScope>; work: Promise<boolean> }>();
  return (input: Omit<InitialWebviewInput, "signal">) => {
    const caller = createPreparationScope();
    const key = `${input.current.row.source_path}\0${input.current.snapshot.loadKey}`;
    let job = running.get(key);
    if (!job) {
      const work = caller
        .run(() => completeInitialWebviews({ ...input, activeBuilds }))
        .finally(() => {
          running.delete(key);
          caller.dispose();
        });
      job = { scope: caller, work };
      running.set(key, job);
    }
    if (caller === job.scope) return job.work;
    const shared = job;
    let release: (() => void) | undefined;
    const refresh = () => {
      if (caller.requested && !release) release = shared.scope.request();
      else if (!caller.requested && release) {
        release();
        release = undefined;
      }
    };
    const unsubscribe = caller.subscribe(refresh);
    refresh();
    return job.work.finally(() => {
      unsubscribe();
      release?.();
      caller.dispose();
    });
  };
};
