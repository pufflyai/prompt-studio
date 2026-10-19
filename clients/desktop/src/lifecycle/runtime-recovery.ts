type RuntimeRecoveryDeps = {
  start: () => Promise<void>;
  canRestart: () => boolean;
  showFailure: (error: unknown) => Promise<void>;
};

// One automatic attempt per launch or manual Retry prevents a crashing backend from
// repeatedly opening the database and interrupting the recovery controls.
export const createRuntimeRecovery = (deps: RuntimeRecoveryDeps) => {
  let automaticRestartAvailable = true;
  let pending: Promise<void> | null = null;
  let interrupted: { error: unknown } | null = null;

  const run = () => {
    if (pending) return pending;
    interrupted = null;
    pending = (async () => {
      try {
        await deps.start();
      } catch (error) {
        interrupted ??= { error };
      } finally {
        // Loading a workbench can finish after its backend exits. Reveal recovery again
        // so that late load cannot hide the error with a disconnected dashboard.
        const failure = interrupted;
        // Recovery exposes Retry immediately; it must start a fresh attempt even while the UI finishes loading.
        pending = null;
        if (failure) await deps.showFailure(failure.error);
      }
    })();
    return pending;
  };

  const start = () => {
    if (!pending) automaticRestartAvailable = true;
    return run();
  };

  const recover = async (error: unknown) => {
    if (pending) {
      interrupted = { error };
      await deps.showFailure(error);
    } else if (automaticRestartAvailable && deps.canRestart()) {
      automaticRestartAvailable = false;
      await run();
    } else {
      await deps.showFailure(error);
    }
  };

  return { start, recover };
};
