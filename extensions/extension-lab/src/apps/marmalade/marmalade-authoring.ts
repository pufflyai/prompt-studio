import type { MarmaladeAction, MarmaladeLayer, MarmaladeState } from "./marmalade.types";
import { setMarmaladeProperties, validateColor } from "./marmalade-layer-properties";
import {
  defaultAdjustments,
  editable,
  findLayer,
  finite,
  marmaladeAncestors,
  range,
  selectedBlock,
  selectedRoots,
} from "./marmalade-layers";

const validateStroke = (points: [number, number][] | undefined) => {
  if (!Array.isArray(points) || points.length < 2) throw new Error("A stroke needs two points");
  for (const point of points) {
    if (!Array.isArray(point) || point.length !== 2) throw new Error("Use coordinate pairs");
    point.forEach(finite);
  }
};
const positive = (value: number) => range(value, 1, 10000);
const create = (state: MarmaladeState, action: Extract<MarmaladeAction, { type: "create" }>) => {
  if (!["text", "rectangle", "ellipse", "brush"].includes(action.kind)) throw new Error("Unknown layer kind");
  finite(action.x);
  finite(action.y);
  const width = action.width ?? 240;
  const height = action.height ?? (action.kind === "text" ? 48 : 160);
  positive(width);
  positive(height);
  const fill = action.color ?? "#f4b860";
  validateColor(fill);
  range(action.strokeWidth ?? 8, 1, 100);
  if (action.kind === "brush") validateStroke(action.points);
  const names = { text: "Text", rectangle: "Rectangle", ellipse: "Ellipse", brush: "Brush stroke" };
  const layer: MarmaladeLayer = {
    id: crypto.randomUUID(),
    name: names[action.kind],
    kind: "shape",
    shape: "rectangle",
    x: action.x,
    y: action.y,
    width,
    height,
    visible: true,
    locked: false,
    opacity: 1,
    color: fill,
  };
  if (action.kind === "text")
    Object.assign(layer, { kind: "text", text: "Your text", fontSize: 40, color: action.color ?? "#ffffff" });
  if (action.kind === "ellipse") layer.shape = "ellipse";
  if (action.kind === "brush")
    Object.assign(layer, {
      kind: "brush",
      points: structuredClone(action.points),
      strokeWidth: action.strokeWidth ?? 8,
    });
  state.document.layers.unshift(layer);
  state.selectedIds = [layer.id];
};
const properties = (state: MarmaladeState, action: Extract<MarmaladeAction, { type: "properties" }>) => {
  const layer = findLayer(state, action.id);
  editable(state, layer);
  setMarmaladeProperties(layer, action.changes);
};
const adjustments = (state: MarmaladeState, action: Extract<MarmaladeAction, { type: "adjustments" }>) => {
  const layer = findLayer(state, action.id);
  editable(state, layer);
  if (layer.kind !== "image") throw new Error("Select an image layer");
  const next = { ...defaultAdjustments, ...layer.adjustments };
  for (const [key, value] of Object.entries(action.changes)) {
    if (!(key in defaultAdjustments)) throw new Error("Unknown adjustment");
    range(value, 0, key === "blur" ? 30 : 200);
    Object.assign(next, { [key]: value });
  }
  layer.adjustments = next;
};
const selectionAction = (state: MarmaladeState, type: "duplicate" | "delete" | "group" | "ungroup") => {
  const roots = selectedRoots(state);
  if (!roots.length) throw new Error("Select a layer");
  const block = selectedBlock(state);
  for (const layer of block) editable(state, layer);
  if (type === "delete") {
    state.document.layers = state.document.layers.filter((layer) => !block.includes(layer));
    state.expandedIds = state.expandedIds.filter((id) => !block.some((layer) => layer.id === id));
    state.selectedIds = [];
  } else if (type === "duplicate") {
    const ids = new Map(block.map((layer) => [layer.id, crypto.randomUUID()]));
    const copies = block.map((layer) => ({
      ...structuredClone(layer),
      id: ids.get(layer.id)!,
      name: `${layer.name} copy`,
      parentId: ids.get(layer.parentId ?? "") ?? layer.parentId,
      x: layer.x + 20,
      y: layer.y + 20,
    }));
    const copiesById = new Map(block.map((layer, index) => [layer.id, copies[index]]));
    const subtrees = new Map(
      roots.map((root) => [
        root.id,
        block
          .filter((layer) => layer === root || marmaladeAncestors(state, layer).includes(root))
          .map((layer) => copiesById.get(layer.id)!),
      ]),
    );
    state.document.layers = state.document.layers.flatMap((layer) => [...(subtrees.get(layer.id) ?? []), layer]);
    state.selectedIds = roots.map((layer) => ids.get(layer.id)!);
    state.expandedIds.push(...block.filter((layer) => layer.kind === "group").map((layer) => ids.get(layer.id)!));
  } else if (type === "group") {
    if (!roots.every((layer) => layer.parentId === roots[0].parentId))
      throw new Error("Select layers in the same group");
    const group: MarmaladeLayer = {
      id: crypto.randomUUID(),
      name: "Group",
      kind: "group",
      parentId: roots[0].parentId,
      x: Math.min(...roots.map((l) => l.x)),
      y: Math.min(...roots.map((l) => l.y)),
      width: 1,
      height: 1,
      visible: true,
      locked: false,
      opacity: 1,
    };
    group.width = Math.max(...roots.map((l) => l.x + l.width)) - group.x;
    group.height = Math.max(...roots.map((l) => l.y + l.height)) - group.y;
    const index = state.document.layers.indexOf(roots[0]);
    state.document.layers = state.document.layers.filter((layer) => !block.includes(layer));
    for (const layer of roots) layer.parentId = group.id;
    state.document.layers.splice(index, 0, group, ...block);
    state.expandedIds.push(group.id);
    state.selectedIds = [group.id];
  } else {
    if (!roots.every((layer) => layer.kind === "group")) throw new Error("Select a group");
    const children: string[] = [];
    for (const group of roots) {
      for (const child of state.document.layers.filter((layer) => layer.parentId === group.id)) {
        child.parentId = group.parentId;
        child.visible = child.visible && group.visible;
        child.opacity *= group.opacity;
        children.push(child.id);
      }
    }
    state.document.layers = state.document.layers.filter((layer) => !roots.includes(layer));
    state.selectedIds = children;
    state.expandedIds = state.expandedIds.filter((id) => !roots.some((layer) => layer.id === id));
  }
};
export const applyMarmaladeAuthoring = (state: MarmaladeState, action: MarmaladeAction) => {
  switch (action.type) {
    case "create":
      create(state, action);
      break;
    case "properties":
      properties(state, action);
      break;
    case "adjustments":
      adjustments(state, action);
      break;
    case "duplicate":
    case "delete":
    case "group":
    case "ungroup":
      selectionAction(state, action.type);
      break;
    default:
      throw new Error("Unknown Marmalade action");
  }
};
