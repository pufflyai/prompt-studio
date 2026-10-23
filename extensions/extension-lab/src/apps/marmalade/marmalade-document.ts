import type { MarmaladeAction, MarmaladeLayer, MarmaladeState } from "./marmalade.types";
import { createMarmaladeState } from "./marmalade-data";

const findLayer = (state: MarmaladeState, id: string) => {
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
const editable = (state: MarmaladeState, layer: MarmaladeLayer) => {
  if (marmaladeLocked(state, layer)) throw new Error(`${layer.name} is locked or unavailable`);
};
const finite = (value: number) => {
  if (!Number.isFinite(value)) throw new Error("Use a finite number");
};
const range = (value: number, min: number, max: number) => {
  finite(value);
  if (value < min || value > max) throw new Error(`Use a value between ${min} and ${max}`);
};
const translate = (state: MarmaladeState, ids: string[], dx: number, dy: number) => {
  finite(dx);
  finite(dy);
  for (const id of ids) findLayer(state, id);
  for (const layer of state.document.layers) {
    if (!ids.includes(layer.id) && !marmaladeAncestors(state, layer).some((parent) => ids.includes(parent.id)))
      continue;
    editable(state, layer);
    layer.x += dx;
    layer.y += dy;
  }
};
const reorder = (state: MarmaladeState, action: Extract<MarmaladeAction, { type: "reorder" }>) => {
  const source = findLayer(state, action.source);
  const ids = state.selectedIds.includes(source.id) ? state.selectedIds : [source.id];
  const selected = ids.map((id) => findLayer(state, id));
  const roots = selected.filter((layer) => !marmaladeAncestors(state, layer).some((parent) => ids.includes(parent.id)));
  const moving = state.document.layers.filter((layer) =>
    roots.some(
      (root) => layer.id === root.id || marmaladeAncestors(state, layer).some((parent) => parent.id === root.id),
    ),
  );
  for (const layer of moving) editable(state, layer);
  const target = action.target ? findLayer(state, action.target) : undefined;
  if (target && moving.includes(target)) throw new Error("A group cannot move into itself or its descendants");
  if (target?.disabled) throw new Error("The target is unavailable");
  if (action.position === "inside" && target && target.kind !== "group") throw new Error("Move inside a group");
  const parentId = action.position === "inside" ? target?.id : target?.parentId;
  if (parentId) editable(state, findLayer(state, parentId));
  const remaining = state.document.layers.filter((layer) => !moving.includes(layer));
  let index = target ? remaining.indexOf(target) : remaining.length;
  if (target && action.position !== "before") {
    index += 1;
    while (
      index < remaining.length &&
      marmaladeAncestors(state, remaining[index]).some((parent) => parent.id === target.id)
    )
      index += 1;
  }
  for (const root of roots) root.parentId = parentId;
  remaining.splice(index, 0, ...moving);
  state.document.layers = remaining;
  if (parentId && !state.expandedIds.includes(parentId)) state.expandedIds.push(parentId);
};

type LayerAction = Extract<MarmaladeAction, { type: "visibility" | "lock" | "text" | "opacity" }>;
const editLayer = (state: MarmaladeState, action: LayerAction) => {
  switch (action.type) {
    case "visibility": {
      if (typeof action.visible !== "boolean") throw new Error("Visibility must be true or false");
      const layer = findLayer(state, action.id);
      if (layer.disabled) throw new Error("The layer is unavailable");
      layer.visible = action.visible;
      break;
    }
    case "lock": {
      if (typeof action.locked !== "boolean") throw new Error("Lock must be true or false");
      const layer = findLayer(state, action.id);
      if (layer.disabled) throw new Error("The layer is unavailable");
      layer.locked = action.locked;
      break;
    }
    case "text": {
      if (typeof action.text !== "string") throw new Error("Text must be a string");
      const layer = findLayer(state, action.id);
      editable(state, layer);
      if (layer.kind !== "text") throw new Error("Select a text layer");
      layer.text = action.text;
      break;
    }
    case "opacity": {
      const layer = findLayer(state, action.id);
      editable(state, layer);
      range(action.opacity, 0, 1);
      layer.opacity = action.opacity;
      break;
    }
  }
};

export const applyMarmaladeAction = (current: MarmaladeState, action: MarmaladeAction) => {
  if (action.type === "reset") return createMarmaladeState();
  const state = structuredClone(current);
  switch (action.type) {
    case "empty":
      state.document.layers = [];
      state.selectedIds = [];
      state.expandedIds = [];
      break;
    case "select":
      state.selectedIds = [...new Set(action.ids)];
      for (const id of state.selectedIds) {
        if (findLayer(state, id).disabled) throw new Error("The layer is unavailable");
      }
      break;
    case "tool":
      if (!["move", "text", "hand", "zoom"].includes(action.tool)) throw new Error("Unknown tool");
      state.tool = action.tool;
      break;
    case "viewport":
      if (action.zoom !== undefined) {
        range(action.zoom, 0.25, 4);
        state.zoom = action.zoom;
      }
      if (action.pan) {
        finite(action.pan.x);
        finite(action.pan.y);
        state.pan = action.pan;
      }
      break;
    case "expand": {
      const layer = findLayer(state, action.id);
      if (layer.kind !== "group") throw new Error("Only groups expand");
      state.expandedIds = state.expandedIds.includes(layer.id)
        ? state.expandedIds.filter((id) => id !== layer.id)
        : [...state.expandedIds, layer.id];
      break;
    }
    case "visibility":
    case "lock":
    case "text":
    case "opacity":
      editLayer(state, action);
      break;
    case "transform": {
      translate(state, action.ids, action.dx, action.dy);
      break;
    }
    case "position": {
      const layer = findLayer(state, action.id);
      translate(state, [layer.id], (action.x ?? layer.x) - layer.x, (action.y ?? layer.y) - layer.y);
      break;
    }
    case "reorder":
      reorder(state, action);
      break;
    default:
      throw new Error("Unknown Marmalade action");
  }
  return state;
};

/** Paint bottom to top; hidden groups suppress their descendants and opacity multiplies through groups. */
export const marmaladeLayers = (state: MarmaladeState) =>
  [...state.document.layers].reverse().flatMap((layer) => {
    const parents = marmaladeAncestors(state, layer);
    if (layer.kind === "group" || [layer, ...parents].some((item) => !item.visible || item.disabled)) return [];
    return [{ ...layer, opacity: parents.reduce((value, parent) => value * parent.opacity, layer.opacity) }];
  });
