import type { Options } from "react-scan";

interface Scanner {
  scan(options: Options): void;
  setOptions(options: Partial<Options>): unknown;
  getOptions(): { value: { enabled?: boolean } };
  isSupported(): boolean;
}

interface RenderOverlayOptions {
  scanner: Scanner;
  storage?: Pick<Storage, "removeItem">;
  setVisible(visible: boolean): void;
}

/** The pinned library has no dispose API. See ADR 0155 for the isolated lifecycle adaptation. */
export const createReactRenderOverlay = (options: RenderOverlayOptions) => {
  const { scanner, storage, setVisible } = options;
  let started = false;
  const clearSavedOptions = () => {
    try {
      storage?.removeItem("react-scan-options");
    } catch {
      // A window without storage also cannot restore the library's saved enabled preference.
    }
  };
  clearSavedOptions();
  scanner.setOptions({ enabled: false });
  clearSavedOptions();
  setVisible(false);

  return {
    state: () => ({
      supported: scanner.isSupported(),
      enabled: scanner.getOptions().value.enabled === true,
      scope: "workbench" as const,
    }),
    setEnabled(enabled: boolean) {
      if (enabled && !scanner.isSupported()) throw new Error("React Scan is unavailable in this build");
      clearSavedOptions();
      if (enabled && !started) {
        scanner.scan({
          enabled: true,
          dangerouslyForceRunInProduction: true,
          showToolbar: false,
          log: false,
          allowInIframe: false,
        });
        started = true;
      } else scanner.setOptions({ enabled });
      clearSavedOptions();
      setVisible(enabled);
    },
  };
};

export type ReactRenderOverlay = ReturnType<typeof createReactRenderOverlay>;
