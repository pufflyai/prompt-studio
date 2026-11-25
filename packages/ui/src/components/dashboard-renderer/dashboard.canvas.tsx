import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { DashboardEmbeddedExample } from "./dashboard-embedded-example";
import { DashboardExample } from "./dashboard-example";
import { DashboardRenderer } from "./dashboard-renderer";

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
