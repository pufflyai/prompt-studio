import type { SettingsRegistry } from "@pstdio/workbench";
import type { PerformanceDiagnosticsAdapter } from "pstdio-api-contracts/performance-diagnostics";

const adapters = new WeakMap<SettingsRegistry, PerformanceDiagnosticsAdapter>();

export const registerPerformanceDiagnostics = (settings: SettingsRegistry, adapter: PerformanceDiagnosticsAdapter) => {
  adapters.set(settings, adapter);
  return () => {
    if (adapters.get(settings) === adapter) adapters.delete(settings);
  };
};

export const getPerformanceDiagnosticsAdapter = (settings: SettingsRegistry) => adapters.get(settings);
