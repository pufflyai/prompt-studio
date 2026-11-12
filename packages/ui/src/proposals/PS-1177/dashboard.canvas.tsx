import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { DashboardPrototype } from "./dashboard-prototype";

export default {
  title: "Proposals/PS-1177 Editable dashboard",
  component: DashboardPrototype,
  fullscreen: true,
  description:
    "An editable dashboard with small grid guides, live panel highlights, and reference-style widget controls. Hover or focus a widget for its floating drag/settings toolbar, selection outline, and square side/bottom resize handles. Highlights share the widget's corner radius. Cards compact upward by default; choose Compact left or Free placement from Display settings. Each widget opens optional title, type, and data settings in an anchored popover. Untitled widgets save normally and omit the heading. Drag or resize on the canvas, then Apply or Cancel. Preview Desktop, Tablet, and Phone in the same frame. Synthetic data and layout stay in frame memory.",
} satisfies CanvasMeta<typeof DashboardPrototype>;

export const Dashboard: CanvasFrame<typeof DashboardPrototype> = {
  id: "proposals-ps-1177--dashboard",
  name: "Editable dashboard",
};
