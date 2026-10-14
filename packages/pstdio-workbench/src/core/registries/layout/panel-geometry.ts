import type {
  MainSecondarySplit,
  ModeContentSplit,
  ModeLayout,
  PagePanelLayout,
  PanelEdge,
} from "@pstdio/sdk/extensions";
import type { WorkbenchLayout } from "./layout-types";

export type MovablePanel = "main" | "secondary" | "side" | "sidenav" | "aside" | "bottom";
export const panelEdges: PanelEdge[] = ["left", "right", "top", "bottom"];
export const defaultModeLayout = () =>
  ({
    axis: "horizontal",
    children: [
      "sidenav",
      {
        axis: "horizontal",
        children: [{ axis: "vertical", children: ["main", "secondary"] }, "side"],
      },
    ],
  }) satisfies ModeLayout;
export const defaultPageLayout = (aside: PanelEdge = "right", bottom: PanelEdge = "bottom") =>
  ({
    axis: "horizontal",
    children:
      aside === "left"
        ? ["aside", { axis: "vertical", children: bottom === "top" ? ["bottom", "main"] : ["main", "bottom"] }]
        : [{ axis: "vertical", children: bottom === "top" ? ["bottom", "main"] : ["main", "bottom"] }, "aside"],
  }) satisfies PagePanelLayout;
const split = (value: unknown, axis: string, leaf: string, accepts: (value: unknown) => boolean) => {
  if (!value || typeof value !== "object") return false;
  const node = value as { axis?: unknown; children?: unknown };
  if (node.axis !== axis || !Array.isArray(node.children) || node.children.length !== 2) return false;
  const [a, b] = node.children;
  return (a === leaf && accepts(b)) || (b === leaf && accepts(a));
};
export const validModeLayout = (value: unknown): value is ModeLayout =>
  split(value, "horizontal", "sidenav", (content) =>
    split(content, "horizontal", "side", (column) => split(column, "vertical", "main", (leaf) => leaf === "secondary")),
  );
export const validPageLayout = (value: unknown): value is PagePanelLayout =>
  split(value, "horizontal", "aside", (column) => split(column, "vertical", "main", (leaf) => leaf === "bottom"));
export const modeContentSplit = (tree: ModeLayout) => tree.children.find((child) => typeof child !== "string")!;
export const modeColumnSplit = (tree: ModeLayout) =>
  modeContentSplit(tree).children.find((child) => typeof child !== "string")!;
export const pageColumnSplit = (tree: PagePanelLayout) => tree.children.find((child) => typeof child !== "string")!;
export const geometryEdge = (layout: WorkbenchLayout, panel: MovablePanel) => {
  const mode = layout.modeLayout ?? defaultModeLayout();
  const page = layout.pageLayout ?? defaultPageLayout();
  if (panel === "sidenav") return mode.children[0] === panel ? "left" : "right";
  if (panel === "side") return modeContentSplit(mode).children[0] === panel ? "left" : "right";
  if (panel === "aside") return page.children[0] === panel ? "left" : "right";
  const column = panel === "bottom" ? pageColumnSplit(page) : modeColumnSplit(mode);
  return column.children[0] === panel ? "top" : "bottom";
};
const geometryEdges: Record<"horizontal" | "vertical", PanelEdge[]> = {
  horizontal: ["left", "right"],
  vertical: ["top", "bottom"],
};
export const allowedGeometryEdges = (panel: MovablePanel) => [
  ...geometryEdges[["side", "sidenav", "aside"].includes(panel) ? "horizontal" : "vertical"],
];
const repositionColumn = (column: MainSecondarySplit, panel: MovablePanel, edge: PanelEdge) => {
  if (panel !== "main" && panel !== "secondary") return column;
  const other = panel === "main" ? "secondary" : "main";
  return { ...column, children: edge === "top" ? [panel, other] : [other, panel] } as MainSecondarySplit;
};
export const repositionGeometry = (layout: WorkbenchLayout, panel: MovablePanel, edge: PanelEdge) => {
  if (!allowedGeometryEdges(panel).includes(edge)) throw new Error(`Panel ${panel} cannot move to ${edge}`);
  const mode = layout.modeLayout ?? defaultModeLayout();
  const content = modeContentSplit(mode);
  const column = modeColumnSplit(mode);
  if (panel === "aside" || panel === "bottom") {
    return {
      ...layout,
      pageLayout: defaultPageLayout(
        panel === "aside" ? edge : geometryEdge(layout, "aside"),
        panel === "bottom" ? edge : geometryEdge(layout, "bottom"),
      ),
    };
  }
  const nextColumn = repositionColumn(column, panel, edge);
  const nextContent: ModeContentSplit = {
    ...content,
    children: (panel === "side" ? edge === "left" : content.children[0] === "side")
      ? ["side", nextColumn]
      : [nextColumn, "side"],
  };
  const nextMode: ModeLayout = {
    ...mode,
    children: (panel === "sidenav" ? edge === "left" : mode.children[0] === "sidenav")
      ? ["sidenav", nextContent]
      : [nextContent, "sidenav"],
  };
  return { ...layout, modeLayout: nextMode };
};

/** Saved placement cannot override a panel that the author has made fixed. */
export const enforceFixedGeometry = (
  layout: WorkbenchLayout,
  defaults: WorkbenchLayout,
  panels: MovablePanel[],
  movable: (panel: MovablePanel) => boolean,
) => {
  let next = layout;
  for (const panel of panels) {
    if (movable(panel)) continue;
    if (geometryEdge(next, panel) === geometryEdge(defaults, panel)) continue;
    next = repositionGeometry(next, panel, geometryEdge(defaults, panel));
  }
  return next;
};
