import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { DashboardPrototype } from "./dashboard-prototype";

export default {
  title: "Proposals/PS-1177 Editable dashboard",
  component: DashboardPrototype,
  fullscreen: true,
  description:
    "An editable dashboard with small grid guides, live panel highlights, and react-resizable corner handles. Cards compact upward by default; choose Compact left or Free placement from the Display settings popover. Each widget opens title, type, and data settings in an anchored popover. Drag or resize on the canvas, then Apply or Cancel. Preview Desktop, Tablet, and Phone in the same frame. Synthetic data and layout stay in frame memory.",
} satisfies CanvasMeta<typeof DashboardPrototype>;

export const Dashboard: CanvasFrame<typeof DashboardPrototype> = {
  id: "proposals-ps-1177--dashboard",
  name: "Editable dashboard",
};
