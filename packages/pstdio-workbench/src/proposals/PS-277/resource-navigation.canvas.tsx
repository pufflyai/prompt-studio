import type { CanvasMeta } from "@pstdio/canvas";
import { ResourceNavigation } from "./resource-navigation";

export default {
  title: "Proposals/PS-277 Menu header",
  description:
    "Move the menu header to any edge by dragging empty header space or using its context menu. It mixes actions and local search, with menu icons rightmost by default. Narrow views use floating bubbles and recover their docked layout with more space. Prompt Studio defaults to one open menu; custom configuration allows several. Drag controls to reorder like the action bar. There is one menu header; dock it to the right to put its icon tray on the outside right edge. Menu surfaces contain content only.",
  fullscreen: true,
} satisfies CanvasMeta;

export const ResourceNavigationInTabs = {
  name: "Movable menu header",
  fullscreen: true,
  render: () => <ResourceNavigation />,
};
