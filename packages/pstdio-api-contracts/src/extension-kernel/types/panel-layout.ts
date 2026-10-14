/** Outer edges of the workbench or a page. */
export type PanelEdge = "left" | "right" | "top" | "bottom";

/** Panel identities stay stable when a split is reversed. Sizes use regionSettings. */
export type MainSecondarySplit = {
  axis: "vertical";
  children: ["main", "secondary"] | ["secondary", "main"];
};
export type ModeContentSplit = {
  axis: "horizontal";
  children: ["side", MainSecondarySplit] | [MainSecondarySplit, "side"];
};
export type ModeLayout = {
  axis: "horizontal";
  children: ["sidenav", ModeContentSplit] | [ModeContentSplit, "sidenav"];
};
export type PageEditorBottomSplit = {
  axis: "vertical";
  children: ["main", "bottom"] | ["bottom", "main"];
};
export type PagePanelLayout = {
  axis: "horizontal";
  children: ["aside", PageEditorBottomSplit] | [PageEditorBottomSplit, "aside"];
};
