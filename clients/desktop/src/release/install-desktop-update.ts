interface NativeUpdateInstaller {
  once(event: "error", listener: (error: Error) => void): unknown;
  removeListener(event: "error", listener: (error: Error) => void): unknown;
  quitAndInstall(): void;
}

export const installDesktopUpdate = (updater: NativeUpdateInstaller, onError: (error: Error) => void) => {
  updater.once("error", onError);
  try {
    updater.quitAndInstall();
  } catch (error) {
    updater.removeListener("error", onError);
    onError(error instanceof Error ? error : new Error(String(error)));
  }
};
