import type { MarmaladeAction, MarmaladeLayer, MarmaladeState } from "./marmalade.types";
import { finite, range } from "./marmalade-layers";

export type MarmaladePresentation = Omit<MarmaladeState, "document">;
export type MarmaladeLayerIndex = Pick<MarmaladeLayer, "id" | "kind" | "disabled">[];
export type MarmaladePresentationAction = Extract<MarmaladeAction, { type: "select" | "expand" | "tool" | "viewport" }>;
export const isMarmaladePresentationAction = (action: MarmaladeAction): action is MarmaladePresentationAction =>
  ["select", "expand", "tool", "viewport"].includes(action.type);
export const marmaladePresentation = ({ selectedIds, expandedIds, tool, zoom, pan }: MarmaladeState) => ({
  selectedIds,
  expandedIds,
  tool,
  zoom,
  pan,
});
export const marmaladeLayerIndex = (document: MarmaladeState["document"]) =>
  document.layers.map(({ id, kind, disabled }) => ({ id, kind, ...(disabled === undefined ? {} : { disabled }) }));
export const reconcileMarmaladePresentation = (values: MarmaladePresentation, layers: MarmaladeLayerIndex) => ({
  ...values,
  selectedIds: values.selectedIds.filter((id) => layers.some((layer) => layer.id === id && !layer.disabled)),
  expandedIds: values.expandedIds.filter((id) => layers.some((layer) => layer.id === id && layer.kind === "group")),
});
export const applyMarmaladePresentation = (
  current: MarmaladePresentation,
  layers: MarmaladeLayerIndex,
  action: MarmaladePresentationAction,
) => {
  const next = structuredClone(current);
  const find = (id: string) => {
    const layer = layers.find((layer) => layer.id === id);
    if (!layer) throw new Error(`Unknown layer: ${id}`);
    return layer;
  };
  switch (action.type) {
    case "select":
      next.selectedIds = [...new Set(action.ids)];
      for (const id of next.selectedIds) if (find(id).disabled) throw new Error("The layer is unavailable");
      break;
    case "expand": {
      const layer = find(action.id);
      if (layer.kind !== "group") throw new Error("Only groups expand");
      next.expandedIds = next.expandedIds.includes(layer.id)
        ? next.expandedIds.filter((id) => id !== layer.id)
        : [...next.expandedIds, layer.id];
      break;
    }
    case "tool":
      if (!["move", "text", "rectangle", "ellipse", "brush", "hand", "zoom"].includes(action.tool))
        throw new Error("Unknown tool");
      next.tool = action.tool;
      break;
    case "viewport":
      if (action.zoom !== undefined) {
        range(action.zoom, 0.25, 4);
        next.zoom = action.zoom;
      }
      if (action.pan) {
        finite(action.pan.x);
        finite(action.pan.y);
        next.pan = structuredClone(action.pan);
      }
      break;
  }
  return next;
};
