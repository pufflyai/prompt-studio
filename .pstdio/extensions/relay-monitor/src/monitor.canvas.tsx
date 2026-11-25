import { useState } from "react";
import { Dashboard } from "./dashboard";
import {
  checks,
  lanes,
  panelDefinitions,
  type Section,
  type Snapshot,
  visible,
  type WindowRange,
  windows,
} from "./model";

export default { title: "Extensions/Relay monitoring", fullscreen: true };
// Synthetic observations exist only in this Canvas module; the shipped webview never imports it.
const Preview = ({ stale = false, failing = false, connected = true }) => {
  const [range, setRange] = useState<WindowRange>("24h");
  const [section, setSection] = useState<Section>("Overview");
  const end = Date.UTC(2026, 10, 21, 18) / 1000,
    start = end - windows[range];
  const snapshot: Snapshot = {
    range,
    section,
    queriedAt: end,
    start,
    end,
    connection: connected ? "connected" : "unavailable",
    message: "Synthetic setup preview · configure a read-only monitoring connection in Settings.",
    checks: checks.map(([id, label]) => ({
      id,
      label,
      state: previewState(id, stale, failing),
      observedAt: stale ? end - 1200 : end - 20,
    })),
    health: Object.values(lanes).flatMap((check) =>
      Array.from({ length: 24 }, (_, index) => ({
        check,
        start: start + (windows[range] * index) / 24,
        end: start + (windows[range] * (index + 1)) / 24,
        state: intervalState(check, index, stale, failing),
      })),
    ),
    panels: panelDefinitions
      .filter((panel) => visible[section].includes(panel.id))
      .map((panel) => ({
        ...panel,
        points: seriesNames(panel.id).flatMap((series, seriesIndex) =>
          Array.from({ length: panel.kind === "capacity" ? 1 : 24 }, (_, index) => ({
            time: panel.kind === "capacity" ? end : start + (windows[range] * index) / 23,
            value: previewValue(panel.kind, index, seriesIndex, stale, failing),
            series,
          })),
        ),
      })),
  };
  return (
    <Dashboard
      snapshot={snapshot}
      loading={false}
      range={range}
      section={section}
      onRange={setRange}
      onSection={setSection}
      onRefresh={() => {}}
    />
  );
};
export const VisualMonitoring = () => <Preview />;
export const SyncFailure = () => <Preview failing />;
export const MissingObservations = () => <Preview stale />;
export const Setup = () => <Preview connected={false} />;

const previewState = (id: string, stale: boolean, failing: boolean): Snapshot["checks"][number]["state"] => {
  if (stale) return "unknown";
  if (failing && id === "sync") return "critical";
  return id === "backup" ? "not-configured" : "ok";
};
const intervalState = (check: string, index: number, stale: boolean, failing: boolean) => {
  if (stale && index > 19) return "Unknown";
  return failing && check === "Sync" && index > 19 ? "Failing" : "Healthy";
};
const seriesNames = (id: string) =>
  (
    ({
      capacity: ["monitoring", "operations"],
      latency: ["p50", "p95", "p99"],
      resources: ["cpu", "memory"],
    }) as Record<string, string[]>
  )[id] ?? ["Observed"];
const previewValue = (kind: string, index: number, seriesIndex: number, stale: boolean, failing: boolean) => {
  if (stale && index > 19) return null;
  if (kind === "capacity") return 25 + seriesIndex * 14;
  return 10 + seriesIndex * 20 + Math.sin(index / 3) * 8 + (failing && index > 19 ? 70 : 0);
};
