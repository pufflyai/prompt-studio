import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { DashboardPrototype } from "./dashboard-prototype";

export default {
  title: "Proposals/PS-1177 Editable dashboard",
  component: DashboardPrototype,
  fullscreen: true,
  description:
    "An editable dashboard with small grid guides, blue hover/resize selection, and square edge handles. Drag/settings controls appear inside the widget's top-right corner. Horizontal drags swap widgets. Vertical drags show a panel-color horizontal indicator only near a row gap; dropping inserts just the dragged widget into a new row. Cards stay in place until that drop. Metric tooltips sit below the card with a date and named value; stacked charts show agent counts and a daily total. Cards compact upward by default; Display settings offers Compact left and Free placement. Widget title, type, and data use a popover. Titles are optional. Apply or Cancel edits, and preview Desktop, Tablet, and Phone. Synthetic data and layout stay in frame memory.",
} satisfies CanvasMeta<typeof DashboardPrototype>;

export const Dashboard: CanvasFrame<typeof DashboardPrototype> = {
  id: "proposals-ps-1177--dashboard",
  name: "Editable dashboard",
};
