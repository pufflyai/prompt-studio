import { Button, Stack } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { useState } from "react";
import { DashboardEmbeddedExample } from "./dashboard-embedded-example";
import { DashboardExample } from "./dashboard-example";
import { DashboardRenderer } from "./dashboard-renderer";
import type { DashboardDataSource, DashboardDefinition, DashboardWidget } from "./dashboard-types";

export default {
  title: "Design system/Components/Data display/Dashboard",
  component: DashboardExample,
  fullscreen: true,
  description:
    "A controlled dashboard with caller-owned data. Edit to add, move, resize, and configure widgets. Horizontal drags swap positions; vertical drags insert near a row gap or rejoin a vacant row slot. Compact up is the default; Free placement preserves gaps. Apply updates the definition and Cancel discards the draft. Preview sizes and date filters belong to this example. The renderer is exported from @pstdio/ui/dashboard-renderer.",
} satisfies CanvasMeta<typeof DashboardExample>;

export const Dashboard: CanvasFrame<typeof DashboardExample> = {
  id: "proposals-ps-1177--dashboard",
  name: "Editable dashboard",
};

export const EmbeddedDashboard = {
  name: "Dashboard in a page",
  render: DashboardEmbeddedExample,
  description:
    "The page owns the header and places dashboard editing beside its controls. A widget renders its own chart.",
  fullscreen: true,
} satisfies CanvasFrame<typeof DashboardEmbeddedExample>;

export const DelayedDashboardSave = {
  name: "Dashboard with a delayed refresh",
  render: () => <DashboardEmbeddedExample deferRefresh />,
  fullscreen: true,
} satisfies CanvasFrame;

export const ChartEdgeCases = {
  name: "Chart precision and group labels",
  fullscreen: true,
  render: () => (
    <DashboardRenderer
      value={{
        mode: "vertical",
        widgets: [
          {
            id: "scatter",
            title: "Scatter precision",
            kind: "scatter",
            source: "group-labels",
            layout: { x: 0, y: 0, w: 6, h: 8 },
          },
          {
            id: "ring",
            title: "Ring precision",
            kind: "ring",
            source: "small-totals",
            layout: { x: 6, y: 0, w: 6, h: 8 },
          },
        ],
      }}
      sources={[
        {
          id: "group-labels",
          name: "Scatter precision and group labels",
          scatter: {
            points: [
              { label: "Open intake", x: 0.0001, y: 1, group: "Unassigned" },
              { label: "Quick check", x: 0.0003, y: 2 },
              { label: "Weekly recap", x: 12, y: 6, group: "0" },
              { label: "Access review", x: 14, y: 8, group: "No group" },
              { label: "New project", x: 16, y: 10, group: "No group (2)" },
            ],
          },
        },
        {
          id: "small-totals",
          name: "Small ring totals",
          series: [
            { label: "Short conversations", value: 0.0004 },
            { label: "Long conversations", value: 0.0006 },
          ],
        },
      ]}
    />
  ),
} satisfies CanvasFrame;

const groupedBars: DashboardWidget[] = [
  { id: "bar", title: "Grouped bars", kind: "bar", source: "series", layout: { x: 0, y: 0, w: 12, h: 7 } },
];

const sourceSelection: DashboardWidget[] = [
  {
    id: "selected",
    title: "Selected source",
    kind: "custom",
    source: "custom",
    layout: { x: 0, y: 0, w: 6, h: 4 },
  },
  {
    id: "missing",
    title: "Missing source",
    kind: "custom",
    source: "missing",
    layout: { x: 6, y: 0, w: 6, h: 4 },
  },
];

const appearanceSources: DashboardDataSource[] = [
  {
    id: "series",
    name: "Bar groups",
    series: [
      { label: "Today", value: 2, group: "Unassigned" },
      { label: "Today", value: 3, group: "Unassigned (2)" },
      { label: "Today", value: 4 },
    ],
  },
  { id: "custom", name: "Build status", content: "Build passed" },
];

function AppearanceExample({ widgets }: { widgets: DashboardWidget[] }) {
  const [value, setValue] = useState<DashboardDefinition>({ mode: "vertical", widgets });
  return <DashboardRenderer value={value} sources={appearanceSources} onChange={setValue} />;
}

function GroupedBarExample() {
  const [value, setValue] = useState<DashboardDefinition>({ mode: "vertical", widgets: groupedBars });
  const [refreshed, setRefreshed] = useState(false);
  const source = appearanceSources[0];
  const series = [...(source.series ?? [])];
  if (refreshed) series.push({ label: "Today", value: 1, group: "Unassigned (3)" });
  return (
    <Stack h="full" minH="0" gap="0">
      <Button alignSelf="start" size="xs" onClick={() => setRefreshed(true)}>
        Add named group
      </Button>
      <DashboardRenderer value={value} sources={[{ ...source, series }]} onChange={setValue} />
    </Stack>
  );
}

export const GroupedBarColors = {
  name: "Grouped bar colors",
  fullscreen: true,
  render: GroupedBarExample,
} satisfies CanvasFrame;

export const WidgetSourceChoices = {
  name: "Widget source choices",
  fullscreen: true,
  render: () => <AppearanceExample widgets={sourceSelection} />,
} satisfies CanvasFrame;
