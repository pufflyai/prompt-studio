import { expect, test } from "bun:test";
import { createMarmaladeState } from "./marmalade-data";
import { applyMarmaladeAction } from "./marmalade-document";

test("drawing tools create editable text, shapes, and brush layers above the composition", () => {
  let state = createMarmaladeState();
  for (const kind of ["text", "rectangle", "ellipse", "brush"] as const) {
    state = applyMarmaladeAction(state, {
      type: "create",
      kind,
      x: 120,
      y: 160,
      width: 240,
      height: 100,
      points:
        kind === "brush"
          ? [
              [0, 0],
              [40, 20],
              [80, 10],
            ]
          : undefined,
    });
    const layer = state.document.layers[0];
    expect(state.selectedIds).toEqual([layer.id]);
    expect(layer.x).toBe(120);
    expect(layer.kind).toBe(kind === "rectangle" || kind === "ellipse" ? "shape" : kind);
  }
  expect(new Set(state.document.layers.map((layer) => layer.id)).size).toBe(state.document.layers.length);
});

test("duplicate preserves nested paint order and deletion removes a selected group once", () => {
  let state = createMarmaladeState();
  state = applyMarmaladeAction(state, { type: "select", ids: ["caption", "title"] });
  state = applyMarmaladeAction(state, { type: "duplicate" });
  const copies = state.document.layers.slice(0, 4);
  expect(copies.map((layer) => layer.name)).toEqual(["Caption copy", "Title copy", "Credit copy", "Caption Card copy"]);
  expect(copies[1].parentId).toBe(copies[0].id);
  expect(copies[1].x).toBe(105);
  expect(state.selectedIds).toEqual([copies[0].id]);
  state = applyMarmaladeAction(state, { type: "delete" });
  expect(state.document.layers.map((layer) => layer.id)).toEqual(
    createMarmaladeState().document.layers.map((layer) => layer.id),
  );
  expect(state.selectedIds).toEqual([]);
});

test("group and ungroup selected siblings preserve coordinates, order, and inherited appearance", () => {
  let state = createMarmaladeState();
  state = applyMarmaladeAction(state, { type: "select", ids: ["title", "credit"] });
  state = applyMarmaladeAction(state, { type: "group" });
  const group = state.document.layers.find((layer) => layer.id === state.selectedIds[0])!;
  expect(group.parentId).toBe("caption");
  expect(state.document.layers.find((layer) => layer.id === "title")?.parentId).toBe(group.id);
  state = applyMarmaladeAction(state, { type: "opacity", id: group.id, opacity: 0.5 });
  state = applyMarmaladeAction(state, { type: "ungroup" });
  expect(state.selectedIds).toEqual(["title", "credit"]);
  expect(state.document.layers.find((layer) => layer.id === "title")).toMatchObject({
    x: 85,
    y: 620,
    parentId: "caption",
    opacity: 0.5,
  });
});

test("duplicating layers from different parents preserves the same hierarchy and paint order", () => {
  let state = applyMarmaladeAction(createMarmaladeState(), { type: "select", ids: ["title", "artwork"] });
  state = applyMarmaladeAction(state, { type: "duplicate" });
  expect(state.document.layers.map((layer) => layer.name)).toEqual([
    "Caption",
    "Title copy",
    "Title",
    "Credit",
    "Caption Card",
    "Reference unavailable",
    "Great Wave copy",
    "Great Wave",
  ]);
  expect(state.document.layers[1].parentId).toBe("caption");
  expect(state.document.layers[6].parentId).toBeUndefined();
});

test("layer properties and image adjustments stay editable and reject invalid values atomically", () => {
  const start = createMarmaladeState();
  const state = applyMarmaladeAction(start, {
    type: "properties",
    id: "title",
    changes: {
      name: "Headline",
      width: 500,
      height: 80,
      rotation: 15,
      color: "#ff6600",
      fontSize: 60,
      fontWeight: "700",
      align: "center",
    },
  });
  expect(state.document.layers.find((layer) => layer.id === "title")).toMatchObject({
    name: "Headline",
    width: 500,
    rotation: 15,
    fontSize: 60,
  });
  const adjusted = applyMarmaladeAction(state, {
    type: "adjustments",
    id: "artwork",
    changes: { brightness: 120, contrast: 140, saturation: 0, blur: 2 },
  });
  expect(adjusted.document.layers.find((layer) => layer.id === "artwork")?.adjustments).toEqual({
    brightness: 120,
    contrast: 140,
    saturation: 0,
    blur: 2,
  });
  expect(() => applyMarmaladeAction(start, { type: "properties", id: "title", changes: { width: -1 } })).toThrow();
  expect(() =>
    applyMarmaladeAction(start, { type: "properties", id: "title", changes: { color: "url(https://example.com)" } }),
  ).toThrow();
  expect(() =>
    applyMarmaladeAction(start, { type: "adjustments", id: "artwork", changes: { brightness: Number.NaN } }),
  ).toThrow();
  expect(start).toEqual(createMarmaladeState());
});

test("locked descendants protect destructive operations and mixed parent grouping is rejected", () => {
  let state = applyMarmaladeAction(createMarmaladeState(), { type: "lock", id: "title", locked: true });
  state = applyMarmaladeAction(state, { type: "select", ids: ["caption"] });
  for (const type of ["duplicate", "delete", "ungroup"] as const)
    expect(() => applyMarmaladeAction(state, { type })).toThrow("locked");
  const mixed = applyMarmaladeAction(createMarmaladeState(), { type: "select", ids: ["title", "artwork"] });
  expect(() => applyMarmaladeAction(mixed, { type: "group" })).toThrow("same group");
});
