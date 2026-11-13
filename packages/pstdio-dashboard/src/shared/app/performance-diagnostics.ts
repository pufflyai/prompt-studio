import type { ScopedQuery } from "@pstdio/sdk/extensions";
import type { SettingsRegistry } from "@pstdio/workbench";
import type { PerformanceDiagnosticsAdapter, PerformanceSnapshot } from "pstdio-api-contracts/performance-diagnostics";

type Adapter = PerformanceDiagnosticsAdapter & { snapshotQuery?: ScopedQuery<PerformanceSnapshot | null> };
const adapters = new WeakMap<SettingsRegistry, Adapter>();

export const registerPerformanceDiagnostics = (settings: SettingsRegistry, adapter: Adapter) => {
  adapters.set(settings, adapter);
  return () => {
    if (adapters.get(settings) === adapter) adapters.delete(settings);
  };
};

export const getPerformanceDiagnosticsAdapter = (settings: SettingsRegistry) => adapters.get(settings);
