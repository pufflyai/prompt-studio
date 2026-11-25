// Monitoring watches production only. The series label and the connection ID use this value.
export const environment = "production";
export const connectionId = `monitoring-${environment}`;
export type WindowRange = "1h" | "24h" | "7d";
export type Section = "Overview" | "Sync" | "Storage" | "Infrastructure" | "Failures";
export type State = "ok" | "warning" | "critical" | "unknown" | "not-configured" | "unsupported";
export interface Point {
  time: number;
  value: number | null;
  series: string;
}
export interface Interval {
  start: number;
  end: number;
  check: string;
  state: string;
}
export interface Panel {
  id: string;
  title: string;
  kind: "line" | "area" | "bar" | "capacity";
  unit: string;
  points: Point[];
  error?: string;
}
export interface Check {
  id: string;
  label: string;
  state: State;
  observedAt: number | null;
}
export interface Snapshot {
  range: WindowRange;
  section: Section;
  queriedAt: number;
  start: number;
  end: number;
  connection: "connected" | "unavailable";
  message?: string;
  health: Interval[];
  panels: Panel[];
  checks: Check[];
}
export const checks = [
  ["http", "HTTP availability"],
  ["dns_tls", "DNS and TLS"],
  ["access", "Access renewal"],
  ["sync", "Encrypted sync"],
  ["blobs", "Blob integrity"],
  ["live", "Live delivery"],
  ["failures", "Service failures"],
  ["storage", "Storage quota"],
  ["cleanup", "Cleanup"],
  ["database", "Database"],
  ["infrastructure", "Resources and deployment"],
  ["backup", "Backup evidence"],
  ["monitoring", "Monitoring freshness"],
] as const;
export const windows = { "1h": 3600, "24h": 86400, "7d": 604800 };
export const lanes: Record<string, string> = {
  http: "HTTP",
  access: "Access",
  sync: "Sync",
  blobs: "Blobs",
  live: "Live",
};
export const panelDefinitions = [
  { id: "latency", title: "Request latency", kind: "line", unit: "ms" },
  { id: "errors", title: "Request failures", kind: "bar", unit: "requests / bin" },
  { id: "storage", title: "Stored data · configured accounts", kind: "area", unit: "GiB" },
  { id: "resources", title: "CPU and memory · busiest instance", kind: "line", unit: "%" },
  { id: "cleanup", title: "Expired cleanup backlog", kind: "area", unit: "MiB" },
  { id: "live", title: "Live canary delivery", kind: "line", unit: "ms" },
  { id: "capacity", title: "Capacity and headroom", kind: "capacity", unit: "%" },
  { id: "ingestion", title: "Observation age", kind: "line", unit: "seconds" },
  { id: "sync", title: "Encrypted sync round trip", kind: "line", unit: "ms" },
  { id: "blobs", title: "Blob integrity round trip", kind: "line", unit: "ms" },
  { id: "tls", title: "TLS certificate lifetime", kind: "line", unit: "days" },
  { id: "deployments", title: "Observed relay builds", kind: "line", unit: "present" },
] as const;
export const visible: Record<Section, readonly string[]> = {
  Overview: ["latency", "errors", "storage", "resources", "cleanup", "capacity"],
  Sync: ["sync", "live", "latency", "errors", "ingestion"],
  Storage: ["storage", "capacity", "blobs", "cleanup", "ingestion"],
  Infrastructure: ["resources", "deployments", "tls", "capacity", "ingestion"],
  Failures: ["errors", "latency", "cleanup", "ingestion"],
};
