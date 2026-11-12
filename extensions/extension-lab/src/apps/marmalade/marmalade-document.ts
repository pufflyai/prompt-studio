import type { MarmaladeAction, MarmaladeState } from "./marmalade.types";
import { applyMarmaladeAuthoring } from "./marmalade-authoring";
import { createMarmaladeState } from "./marmalade-data";
import { editable, findLayer, finite, marmaladeAncestors, range, setMarmaladeParent } from "./marmalade-layers";

import {
  applyMarmaladePresentation,
  isMarmaladePresentationAction,
  marmaladeLayerIndex,
  marmaladePresentation,
} from "./marmalade-presentation";

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
  for (const root of roots) setMarmaladeParent(root, parentId);
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
  if (isMarmaladePresentationAction(action))
    return {
      ...state,
      ...applyMarmaladePresentation(marmaladePresentation(state), marmaladeLayerIndex(state.document), action),
    };
  switch (action.type) {
    case "empty":
      state.document.layers = [];
      state.selectedIds = [];
      state.expandedIds = [];
      break;
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
      applyMarmaladeAuthoring(state, action);
  }
  return state;
};
