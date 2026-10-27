import type { MarmaladeLayer, MarmaladeState } from "./marmalade.types";

export const findLayer = (state: MarmaladeState, id: string) => {
  const layer = state.document.layers.find((item) => item.id === id);
  if (!layer) throw new Error(`Unknown layer: ${id}`);
  return layer;
};
export const marmaladeAncestors = (state: MarmaladeState, layer: MarmaladeLayer) => {
  const ancestors: MarmaladeLayer[] = [];
  let parentId = layer.parentId;
  while (parentId) {
    const parent = findLayer(state, parentId);
    ancestors.push(parent);
    parentId = parent.parentId;
  }
  return ancestors;
};
export const marmaladeLocked = (state: MarmaladeState, layer: MarmaladeLayer) =>
  [layer, ...marmaladeAncestors(state, layer)].some((item) => item.locked || item.disabled);
export const editable = (state: MarmaladeState, layer: MarmaladeLayer) => {
  if (marmaladeLocked(state, layer)) throw new Error(`${layer.name} is locked or unavailable`);
};
export const finite = (value: number) => {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error("Use a finite number");
};
export const range = (value: number, min: number, max: number) => {
  finite(value);
  if (value < min || value > max) throw new Error(`Use a value between ${min} and ${max}`);
};
export const selectedRoots = (state: MarmaladeState) => {
  const selected = state.selectedIds.map((id) => findLayer(state, id));
  return state.document.layers.filter(
    (layer) =>
      selected.includes(layer) && !marmaladeAncestors(state, layer).some((parent) => selected.includes(parent)),
  );
};
export const selectedBlock = (state: MarmaladeState) => {
  const roots = selectedRoots(state);
  return state.document.layers.filter(
    (layer) => roots.includes(layer) || marmaladeAncestors(state, layer).some((parent) => roots.includes(parent)),
  );
};
/** Paint bottom to top; hidden groups suppress descendants and opacity multiplies through groups. */
export const marmaladeLayers = (state: MarmaladeState) =>
  [...state.document.layers].reverse().flatMap((layer) => {
    const parents = marmaladeAncestors(state, layer);
    if (layer.kind === "group" || [layer, ...parents].some((item) => !item.visible || item.disabled)) return [];
    return [{ ...layer, opacity: parents.reduce((value, parent) => value * parent.opacity, layer.opacity) }];
  });
export const defaultAdjustments = { brightness: 100, contrast: 100, saturation: 100, blur: 0 };
