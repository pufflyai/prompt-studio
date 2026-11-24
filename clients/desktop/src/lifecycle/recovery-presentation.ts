import type { DesktopRecoveryError } from "./lifecycle-machine";

export type NativeRecoveryAction = DesktopRecoveryError["actions"][number];

interface RecoveryPresentation {
  showLifecycle(): Promise<void>;
  showNative(error: DesktopRecoveryError): Promise<NativeRecoveryAction>;
  openLogs(): void;
  retry(): void;
  quit(): Promise<void>;
  isQuitting(): boolean;
}

export const createRecoveryPresentation = (deps: RecoveryPresentation) => {
  let currentError: DesktopRecoveryError;
  let native: Promise<void> | undefined;
  const showNative = async () => {
    while (!deps.isQuitting()) {
      const action = await deps.showNative(currentError);
      if (deps.isQuitting()) return;
      if (action === "open_logs") deps.openLogs();
      else if (action === "retry") {
        native = undefined;
        deps.retry();
        return;
      } else await deps.quit();
    }
  };
  return async (error: DesktopRecoveryError) => {
    currentError = error;
    try {
      await deps.showLifecycle();
    } catch {
      // The renderer's recovery controls need its preload too. Keep one native dialog available instead.
      if (!native) {
        const pending = showNative().finally(() => {
          if (native === pending) native = undefined;
        });
        native = pending;
      }
      await native;
    }
  };
};
