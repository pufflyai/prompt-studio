import type { PerformanceSnapshot } from "./performance-diagnostics";

export interface PerformanceMonitoringState {
  enabled: boolean;
  host: "desktop" | "browser";
}

export interface PerformanceRecordingExport {
  directory: string;
  files: { name: string; content: string }[];
}

export type PerformanceReadRequest = {
  operation: "state" | "snapshot" | "subscribe" | "unsubscribe" | "recordings" | "retain" | "dispose";
};
export type PerformanceControlRequest =
  | { operation: "set-enabled"; enabled: boolean }
  | { operation: "pause-extension" | "resume-extension"; installedExtensionId: string };
export type PerformanceReadResult =
  | PerformanceMonitoringState
  | PerformanceSnapshot
  | PerformanceRecordingExport
  | null
  | undefined;

/** Host-only adapter. The bridge enforces manifest permissions before invoking it. */
export interface PerformanceDiagnosticsAdapter {
  state(): Promise<PerformanceMonitoringState>;
  recordings(): Promise<PerformanceRecordingExport | null>;
  retain(): Promise<() => Promise<void>>;
  snapshot(): Promise<PerformanceSnapshot | null>;
  /** Host owns the single poller; consumers add listeners only. */
  subscribe(listener: (snapshot: PerformanceSnapshot | null) => void): () => void;
  /** Requires an active local user interaction. Runtime commands cannot invoke this device control. */
  control(request: PerformanceControlRequest): Promise<void>;
}
