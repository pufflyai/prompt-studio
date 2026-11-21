export type Condition = "healthy" | "storage-failure" | "stale" | "disconnected" | "setup";

export const sections = ["Overview", "Checks", "Storage", "Failures", "Infrastructure", "Connection"];

export const checks = [
  ["health", "HTTP availability", "Healthy", "210 ms", "Public health endpoint responded with the expected body."],
  ["tls", "DNS and certificate", "Healthy", "62 days", "DNS resolved and the TLS certificate is valid."],
  ["auth", "Access renewal", "Healthy", "180 ms", "Both monitoring devices renewed finite access tokens."],
  ["sync", "Encrypted sync", "Healthy", "430 ms", "A monitoring update was read back and decrypted successfully."],
  ["blob", "Blob integrity", "Healthy", "650 ms", "Downloaded monitoring bytes match the uploaded length and hash."],
  ["live", "Live delivery", "Healthy", "95 ms", "An encrypted message reached the second monitoring device."],
  ["quota", "Account quota", "Healthy", "38%", "Aggregate relay account usage is below its configured quota."],
  ["cleanup", "Cleanup", "Healthy", "23 min ago", "The last cleanup completed; no expired backlog is overdue."],
  ["db", "Database", "Healthy", "12 ms", "The bounded read-only database health query completed."],
  ["resources", "Service resources", "Healthy", "1 instance", "The expected single relay instance is running."],
  ["backup", "Backup evidence", "Not configured", "—", "No backup job or restore evidence source is connected."],
  [
    "collector",
    "Collector heartbeat",
    "Healthy",
    "20 sec ago",
    "The always-on collector is sending fresh observations.",
  ],
];

export const checkRows = (condition: Condition) =>
  checks.map(([id, check, state, value, detail]) => {
    if (condition === "storage-failure" && ["sync", "blob"].includes(id))
      return {
        id,
        check,
        state: "Failing",
        value: "Timed out",
        detail: "Object storage did not complete the monitoring operation.",
      };
    if (condition === "stale")
      return {
        id,
        check,
        state: "Unknown",
        value: "12 min ago",
        detail: "Collection is stale. This is the last observation, not current relay status.",
      };
    return { id, check, state, value, detail };
  });

export const storageRows = [
  { id: "total", item: "Account usage", value: "19 GiB / 50 GiB", status: "Healthy" },
  { id: "growth", item: "Growth over 24 hours", value: "+240 MiB", status: "Observed" },
  { id: "updates", item: "Updates and states", value: "3.2 GiB", status: "Observed" },
  { id: "blobs", item: "Completed blobs", value: "15.8 GiB", status: "Observed" },
  { id: "uploads", item: "Unfinished uploads", value: "12 · 24 MiB", status: "Within grace period" },
  { id: "orphans", item: "Orphaned blobs", value: "84 MiB", status: "Within grace period" },
  { id: "expired", item: "Expired cleanup backlog", value: "0 bytes", status: "Healthy" },
];

export const infrastructureRows = [
  { id: "release", item: "Relay release", value: "Example build 400c5e4", status: "Observed" },
  { id: "instances", item: "Relay instances", value: "1 expected / 1 running", status: "Healthy" },
  { id: "cpu", item: "Relay CPU", value: "18%", status: "Healthy" },
  { id: "memory", item: "Relay memory", value: "41%", status: "Healthy" },
  { id: "ingestion", item: "Metrics ingestion", value: "20 sec ago", status: "Healthy" },
  { id: "retention", item: "History retention", value: "30 days metrics / 14 days logs", status: "Configured" },
  { id: "alerting", item: "Alert receiver", value: "Operations webhook", status: "Delivery verified" },
  { id: "backup", item: "Backup / restore evidence", value: "No source connected", status: "Not configured" },
];

export const latency = [210, 225, 220, 242, null, 216, 212, 245, 240, 230, 218, 210].map((ms, index) => ({
  interval: index,
  ms,
}));
