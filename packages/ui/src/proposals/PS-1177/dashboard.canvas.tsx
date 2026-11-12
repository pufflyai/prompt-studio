import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { DashboardPrototype } from "./dashboard-prototype";

export default {
  title: "Proposals/PS-1177 Editable dashboard",
  component: DashboardPrototype,
  fullscreen: true,
  description:
    "A responsive dashboard using shared charts, tables, cards, and menus. Switch preview size, enter Edit dashboard, add widgets, configure type/data/title/size, reorder with a drag handle or move buttons, then Apply or Cancel. The synthetic data and layout stay in this frame’s memory; no project records are changed.",
} satisfies CanvasMeta<typeof DashboardPrototype>;

export const Dashboard: CanvasFrame<typeof DashboardPrototype> = {
  id: "proposals-ps-1177--dashboard",
  name: "Editable dashboard",
};
