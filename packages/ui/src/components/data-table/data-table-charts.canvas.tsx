import { Badge, Box, Button, HStack } from "@chakra-ui/react";
import { DEFAULT_DATA_TABLE_SETTINGS } from "@pstdio/sdk/extensions";
import { useState } from "react";
import { DataTable, type DataTableProps, type RowData } from ".";

interface Metric {
  name: string;
  history: (number | null)[];
  base: number | null;
  head: number | null;
}
const timing: Metric[] = [
  { name: "Cold start", history: [5400, 5150, 4900, null, 4800, 5300], base: 4800, head: 5300 },
  { name: "Warm start", history: [2300, 2220, 2150, 2100, 2100, 1800], base: 2100, head: 1800 },
  { name: "Switch workspace", history: [420, 405, 390, 410, 400, 510], base: 400, head: 510 },
  { name: "Open conversation", history: [82, 80, 90, 78, 74, 71], base: 74, head: 71 },
  { name: "Save file", history: [18, 18, 16, 17, 16, 14], base: 16, head: 14 },
  { name: "New benchmark", history: [null, null, null, null, null, 42], base: null, head: 42 },
  { name: "Queued benchmark", history: [null, null, null], base: null, head: null },
];
const memory: Metric[] = [
  { name: "App memory", history: [712, 705, 690, 675, 660, 628], base: 660, head: 628 },
  { name: "Conversation heap", history: [58, 60, 62, null, 63, 78], base: 63, head: 78 },
  { name: "Workspace heap", history: [90, 86, 82, 84, 85, 78], base: 85, head: 78 },
  { name: "Idle allocations", history: [0, 0, 0, 0, 0, 0], base: 0, head: 0 },
];
const changes: Metric[] = [
  { name: "Requests per interval", history: [-12, -4, 0, 6, 18, 12], base: -12, head: 12 },
  { name: "Cache balance", history: [10, 7, 4, -2, -6, -8], base: 4, head: -8 },
  { name: "No net change", history: [0, 0, 0, 0], base: 0, head: 0 },
];

const defaults: DataTableProps["defaultViews"] = [
  {
    id: "expanded",
    title: "Expanded",
    filter: { conjunction: "and", rules: [] },
    sorts: [],
    settings: { ...DEFAULT_DATA_TABLE_SETTINGS, rowHeight: "tall", showStats: false, rowNumbers: false },
  },
  {
    id: "compact",
    title: "Compact",
    filter: { conjunction: "and", rules: [] },
    sorts: [],
    settings: { ...DEFAULT_DATA_TABLE_SETTINGS, rowHeight: "compact", showStats: false, rowNumbers: false },
  },
];

export default {
  title: "Design system/Components/Data display/Data table/Inline charts",
  fullscreen: true,
  description:
    "Inline history and thicker full-width comparison bars with rounded outer ends and square baselines. Bars stay grouped with gaps at most half their thickness; Compact uses fuller bars with a tighter gap. Bar labels stay in tooltips. Hover a bar or history point for its measurement; focus a chart for all measurements. Choose Expanded or Compact, or change Row height in Display. Memory includes zeroes; Changes includes signed bars.",
};

export const Performance = () => {
  const [example, setExample] = useState("Timing");
  const metrics = example === "Memory" ? memory : timing;
  const shown = example === "Changes" ? changes : metrics;
  const unit = example === "Memory" ? "MB" : "ms";
  const chartUnit = example === "Changes" ? undefined : unit;
  const rows: RowData[] = shown.map((metric) => {
    let difference = "—";
    let change = 0;
    if (metric.base !== null && metric.head !== null) {
      change =
        metric.base === 0 ? metric.head - metric.base : ((metric.head - metric.base) / Math.abs(metric.base)) * 100;
      difference = `${change > 0 ? "+" : ""}${change.toFixed(1)}%`;
    }
    let palette = "gray";
    if (change > 0) palette = "red";
    if (change < 0) palette = "green";
    return {
      Metric: metric.name,
      History: { values: metric.history, labels: metric.history.map((_, index) => `Run ${index + 1}`) },
      "Base and head": { values: [metric.base, metric.head], labels: ["Base", "Head"] },
      Difference: { display: <Badge colorPalette={palette}>{difference}</Badge>, sortValue: change },
    };
  });
  return (
    <Box h="100dvh" p="lg" bg="bg">
      <DataTable
        key={example}
        data={rows}
        fullWidth
        itemLabel="Metrics"
        toolbarStorageKey={`canvas-inline-chart-cells-${example}`}
        defaultViews={defaults}
        defaultActiveViewId="expanded"
        defaultSettings={{ rowHeight: "tall", showStats: false, rowNumbers: false }}
        columnRenderers={{
          History: { type: "sparkline", unit: chartUnit },
          "Base and head": { type: "bar-chart", unit: chartUnit },
        }}
        toolbarActions={
          <HStack gap="xs">
            {["Timing", "Memory", "Changes"].map((name) => (
              <Button
                key={name}
                size="xs"
                variant={name === example ? "subtle" : "ghost"}
                onClick={() => setExample(name)}
              >
                {name}
              </Button>
            ))}
          </HStack>
        }
      />
    </Box>
  );
};
