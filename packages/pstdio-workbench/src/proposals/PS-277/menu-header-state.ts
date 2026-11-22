export type MenuHeaderPosition = "top" | "right" | "bottom" | "left";
export interface MenuHeaderSettings {
  position: MenuHeaderPosition;
  order: string[];
}
export const headerPositions: MenuHeaderPosition[] = ["top", "right", "bottom", "left"];
export const initialMenuHeader: MenuHeaderSettings = {
  position: "top",
  order: ["complete", "search", "resources", "activity", "properties"],
};

export const reorderHeader = (order: string[], id: string, target: string, edge: "before" | "after") => {
  if (id === target || !order.includes(id) || !order.includes(target)) return order;
  const next = order.filter((item) => item !== id);
  next.splice(next.indexOf(target) + Number(edge === "after"), 0, id);
  return next;
};
