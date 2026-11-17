import { RENDER_CAPTURE_LIMITS, type ReactRenderSummaryRow } from "pstdio-api-contracts/performance-diagnostics";

type InputChange = "changed" | "unchanged" | "unknown";
const addTime = (total: number | null, ms: number | null) => {
  if (ms === null || !Number.isFinite(ms) || ms < 0) return total;
  return (total ?? 0) + ms;
};

export const createRenderSummary = () => {
  const rows = new Map<string | null, ReactRenderSummaryRow>();
  let samples = 0;
  let truncated = false;
  return {
    full() {
      if (samples < RENDER_CAPTURE_LIMITS.renders) return false;
      truncated = true;
      return true;
    },
    record(componentName: string | null, ms: number | null, input: InputChange) {
      if (samples >= RENDER_CAPTURE_LIMITS.renders) {
        truncated = true;
        return;
      }
      samples += 1;
      const name = componentName?.slice(0, RENDER_CAPTURE_LIMITS.nameLength) ?? null;
      let row = rows.get(name);
      if (!row) {
        if (rows.size >= RENDER_CAPTURE_LIMITS.names) {
          truncated = true;
          return;
        }
        row = { name, renders: 0, unchanged: 0, unknown: 0, renderMs: null, unchangedRenderMs: null };
        rows.set(name, row);
      }
      row.renders += 1;
      row.renderMs = addTime(row.renderMs, ms);
      if (input === "unknown") row.unknown += 1;
      if (input === "unchanged") {
        row.unchanged += 1;
        row.unchangedRenderMs = addTime(row.unchangedRenderMs, ms);
      }
    },
    finish() {
      const components = [...rows.values()]
        .sort(
          (a, b) =>
            (b.unchangedRenderMs ?? 0) - (a.unchangedRenderMs ?? 0) ||
            b.unchanged - a.unchanged ||
            (b.renderMs ?? 0) - (a.renderMs ?? 0),
        )
        .slice(0, RENDER_CAPTURE_LIMITS.rows);
      return { components, truncated: truncated || components.length < rows.size };
    },
  };
};
