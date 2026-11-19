import { withRuntimeOperationOrigin } from "pstdio-diagnostics";
import type { ExtensionsRouteDeps } from "../../features/extensions/deps";
import { apiLogger } from "../../lib/logger";

/**
 * Captures due recovery points once a minute. Capture needs no network, so a running device keeps
 * rotating the points of projects that already have them, even offline.
 */
export const startRecoveryCapture = (input: {
  recovery: ExtensionsRouteDeps["extensionStorageService"]["recovery"];
  /** Cloud projects that finished their first download. */
  projects: () => Promise<string[]>;
}) => {
  let running: Promise<void> | undefined;
  let closed = false;
  const suspended = new Set<string>();
  let capturing: string | undefined;
  let inFlight: Promise<unknown> | undefined;
  const run = async () => {
    try {
      const projects = new Set([...(await input.recovery.projects()), ...(await input.projects())]);
      for (const projectId of projects) {
        if (closed) break;
        if (suspended.has(projectId)) continue;
        capturing = projectId;
        inFlight = input.recovery.capture(projectId).catch((error) => {
          apiLogger.warn(
            { event: "recovery.capture.failed", projectId, error },
            "Recovery point not captured; saved project data is unchanged",
          );
        });
        await inFlight;
        capturing = undefined;
        inFlight = undefined;
      }
    } catch (error) {
      apiLogger.warn(
        { event: "recovery.capture.failed", error },
        "Recovery points could not be read; capture will retry",
      );
    } finally {
      running = undefined;
    }
  };
  const capture = () => {
    if (closed) return Promise.resolve();
    running ??= withRuntimeOperationOrigin({ kind: "background", name: "recovery.capture" }, run);
    return running;
  };
  const timer = setInterval(() => void capture(), 60_000);
  timer.unref?.();
  return {
    capture,
    async suspend(id: string) {
      suspended.add(id);
      if (capturing === id) await inFlight;
    },
    release: (id: string) => suspended.delete(id),
    async close() {
      closed = true;
      clearInterval(timer);
      await running;
    },
  };
};
