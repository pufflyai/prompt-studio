import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { RelayMonitorDesign } from "./relay-monitor";

export default {
  title: "Proposals/PS-1281 Relay monitoring",
  component: RelayMonitorDesign,
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
} satisfies CanvasMeta<typeof RelayMonitorDesign>;

export const Interactive: CanvasFrame<typeof RelayMonitorDesign> = {
  description:
    "Explore overview, check details, storage, failures, infrastructure and connection setup. Use the condition parameter to inspect failure and freshness states. All data is synthetic.",
};
