import type { ScopedQuery } from "@pstdio/sdk/extensions";
import type { createRendererReadAdmission } from "./renderer-read-admission";

/** A presentation retains its snapshot while its own pending saves suspend automatic reads. */
export const createRendererQueryLease = (
  query: ScopedQuery<unknown>,
  notify: () => void,
  admission: ReturnType<typeof createRendererReadAdmission>,
  onInvalidate?: () => boolean,
) => {
  let admitted = false;
  let holds = 0;
  let disposed = false;
  let automatic = false;
  let restarting = false;
  let checkedRevision: number | undefined;
  let stop = query.subscribe(notify, { automatic: false });
  const updateAutomatic = () => {
    const next = admitted && holds === 0 && !admission.held() && !restarting;
    if (disposed || query.isDisposed() || next === automatic) return;
    automatic = next;
    // Keep the upstream subscription continuous while changing admission policy.
    const previous = stop;
    stop = query.subscribe(notify, { automatic });
    previous();
  };
  const update = () => {
    if (disposed || query.isDisposed()) return;
    const state = query.inspect();
    if (
      admitted &&
      !admission.held() &&
      state.stale &&
      state.revision !== checkedRevision &&
      query.getSnapshot().data !== undefined &&
      onInvalidate &&
      !restarting
    ) {
      checkedRevision = state.revision;
      restarting = true;
      updateAutomatic();
      restarting = onInvalidate() !== false;
    }
    updateAutomatic();
  };
  const stopAdmission = admission.subscribe(update);
  const stopInvalidation = query.subscribeInvalidation(update);
  return {
    admit() {
      admitted = true;
      update();
      return !restarting;
    },
    hold() {
      holds++;
      update();
      let released = false;
      return () => {
        if (released) return;
        released = true;
        holds--;
        update();
      };
    },
    dispose() {
      disposed = true;
      stopAdmission();
      stopInvalidation();
      stop();
    },
  };
};
