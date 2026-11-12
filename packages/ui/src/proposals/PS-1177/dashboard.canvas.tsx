import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { DashboardPrototype } from "./dashboard-prototype";

export default {
  title: "Proposals/PS-1177 Editable dashboard",
  component: DashboardPrototype,
  fullscreen: true,
  description:
    "An editable dashboard with small grid guides, panel-color highlights, and square edge resize handles. Hover, focus, or tap a widget for drag/settings controls inside its top-right corner. Dropping onto another widget swaps their positions while preserving their sizes; the preview shows the result. Highlights share the widget's corner radius and panel drop-zone color. Cards compact upward by default; choose Compact left or Free placement from Display settings. Title, type, and data use a settings popover. Titles are optional. Apply or Cancel edits, and preview Desktop, Tablet, and Phone in the same frame. Synthetic data and layout stay in frame memory.",
} satisfies CanvasMeta<typeof DashboardPrototype>;

export const Dashboard: CanvasFrame<typeof DashboardPrototype> = {
  id: "proposals-ps-1177--dashboard",
  name: "Editable dashboard",
};
