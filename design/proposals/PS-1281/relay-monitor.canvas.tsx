import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { RelayMonitorDesign } from "./relay-monitor";
import { VisualMonitor } from "./visual-monitor";

export default {
  title: "Proposals/PS-1281 Relay monitoring",
  component: VisualMonitor,
  fullscreen: true,
  args: { condition: "healthy" },
  controls: {
    condition: {
      type: "select",
      options: [
        { value: "healthy", label: "Healthy" },
        { value: "storage-failure", label: "Storage failure with HTTP healthy" },
        { value: "stale", label: "Collector stale" },
        { value: "disconnected", label: "Query connection unavailable" },
        { value: "setup", label: "Not connected" },
      ],
    },
  },
} satisfies CanvasMeta<typeof VisualMonitor>;

export const VisualOverview: CanvasFrame<typeof VisualMonitor> = {
  name: "Visual monitoring",
  description:
    "Preferred design: a health timeline and large charts for latency, errors, storage, cleanup, resource usage and capacity. Environment and time controls apply to every chart. Inspect data opens exact observations on demand. Condition selects failure, stale and connection states; all data is synthetic.",
};

export const Interactive: CanvasFrame<typeof RelayMonitorDesign> = {
  name: "Earlier table overview",
  render: (args) => <RelayMonitorDesign {...args} />,
  description:
    "Explore overview, check details, storage, failures, infrastructure and connection setup. Use the condition parameter to inspect failure and freshness states. All data is synthetic.",
};
