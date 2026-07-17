export type SplitDirection = "row" | "column";

export const getElementSize = (element: HTMLDivElement | null, direction: SplitDirection) => {
  const bounds = element?.getBoundingClientRect();
  return direction === "row" ? (bounds?.width ?? 0) : (bounds?.height ?? 0);
};

export const applyPaneSizeToElement = (pane: HTMLDivElement | null, direction: SplitDirection, size: number) => {
  if (!pane) return;

  const value = `${size}px`;
  pane.style.width = direction === "row" ? value : "";
  pane.style.height = direction === "column" ? value : "";
  pane.style.flexBasis = value;
  pane.style.flexGrow = "0";
  pane.style.flexShrink = "0";
  pane.style.display = size > 0 ? "flex" : "none";
};

export const clearPaneInlineStyles = (pane: HTMLDivElement | null, collapsed: boolean) => {
  if (!pane) return;

  pane.style.width = "";
  pane.style.height = "";
  pane.style.flexBasis = "";
  pane.style.flexGrow = "";
  pane.style.flexShrink = "";
  pane.style.display = collapsed ? "none" : "";
};
