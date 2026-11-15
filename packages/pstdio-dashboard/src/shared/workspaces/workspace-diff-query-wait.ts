import type { ScopedQuery } from "@pstdio/sdk/extensions";
import type { DashboardWorkspaceDiffSummary } from "./workspace-diff-summary-data";

/** Decoration observes automatic work without promoting it to a required read. */
export const waitForWorkspaceDiffSummary = (
  query: ScopedQuery<DashboardWorkspaceDiffSummary | null>,
  signal?: AbortSignal,
) =>
  new Promise<DashboardWorkspaceDiffSummary | null>((resolve, reject) => {
    let finished = false;
    let stop = () => {};
    const finish = (complete: () => void) => {
      if (finished) return;
      finished = true;
      signal?.removeEventListener("abort", aborted);
      stop();
      complete();
    };
    const aborted = () => finish(() => reject(signal?.reason));
    const changed = () => {
      if (signal?.aborted) return aborted();
      if (query.isDisposed()) return finish(() => reject(new Error("Workspace diff owner is disposed")));
      const snapshot = query.getSnapshot();
      if (snapshot.fetching || query.inspect().stale) return;
      if (snapshot.error) finish(() => reject(snapshot.error));
      else if (snapshot.data !== undefined) {
        const summary = snapshot.data;
        finish(() => resolve(summary));
      }
    };
    signal?.addEventListener("abort", aborted, { once: true });
    try {
      if (signal?.aborted) return aborted();
      stop = query.subscribe(changed);
      if (finished) stop();
      else changed();
    } catch (error) {
      finish(() => reject(error));
    }
  });
