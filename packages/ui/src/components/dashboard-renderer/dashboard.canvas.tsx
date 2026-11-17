import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { DashboardExample } from "./dashboard-example";

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
