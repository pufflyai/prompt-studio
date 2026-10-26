import { expect, test } from "bun:test";
import { createMarmaladeState } from "./marmalade-data";
import { applyMarmaladeAction } from "./marmalade-document";
import { marmaladeLayers } from "./marmalade-layers";

test("visibility and lock actions keep document selection unchanged", () => {
  const initial = createMarmaladeState();
  const hidden = applyMarmaladeAction(initial, { type: "visibility", id: "artwork", visible: false });
  expect(hidden.selectedIds).toEqual(initial.selectedIds);
  expect(hidden.document.layers.find((layer) => layer.id === "artwork")?.visible).toBe(false);
  const locked = applyMarmaladeAction(hidden, { type: "lock", id: "artwork", locked: true });
  expect(locked.selectedIds).toEqual(initial.selectedIds);
  expect(() => applyMarmaladeAction(locked, { type: "transform", ids: ["artwork"], dx: 10, dy: 0 })).toThrow("locked");
});

test("moving selected layers preserves their order and can move into and out of groups", () => {
  const initial = createMarmaladeState();
  const selected = applyMarmaladeAction(initial, { type: "select", ids: ["title", "credit"] });
  const grouped = applyMarmaladeAction(selected, {
    type: "reorder",
    source: "title",
    target: "caption",
    position: "inside",
  });
  expect(grouped.document.layers.filter((layer) => layer.parentId === "caption").map((layer) => layer.id)).toEqual([
    "card",
    "title",
    "credit",
  ]);
  const moved = applyMarmaladeAction(grouped, {
    type: "reorder",
    source: "title",
    target: "artwork",
    position: "after",
  });
  expect(
    moved.document.layers.filter((layer) => ["title", "credit"].includes(layer.id)).every((layer) => !layer.parentId),
  ).toBe(true);
  expect(moved.selectedIds).toEqual(["title", "credit"]);
  expect(moved.document.layers.map((layer) => layer.id).slice(-2)).toEqual(["title", "credit"]);
});

test("groups cannot become their own descendants and inherited locks protect children", () => {
  const initial = createMarmaladeState();
  expect(() =>
    applyMarmaladeAction(initial, { type: "reorder", source: "caption", target: "card", position: "inside" }),
  ).toThrow();
  const locked = applyMarmaladeAction(initial, { type: "lock", id: "caption", locked: true });
  expect(() => applyMarmaladeAction(locked, { type: "transform", ids: ["card"], dx: 10, dy: 2 })).toThrow("locked");
  expect(() => applyMarmaladeAction(locked, { type: "text", id: "title", text: "Changed" })).toThrow("locked");
});

test("group transforms move each descendant once and preserve editable text", () => {
  const initial = createMarmaladeState();
  const grouped = applyMarmaladeAction(initial, {
    type: "reorder",
    source: "title",
    target: "caption",
    position: "inside",
  });
  const next = applyMarmaladeAction(grouped, { type: "transform", ids: ["caption", "title"], dx: 16, dy: -8 });
  const before = grouped.document.layers.find((layer) => layer.id === "title")!;
  expect(next.document.layers.find((layer) => layer.id === "title")).toMatchObject({
    x: before.x + 16,
    y: before.y - 8,
  });
  const edited = applyMarmaladeAction(next, { type: "text", id: "title", text: "Ocean study" });
  expect(edited.document.layers.find((layer) => layer.id === "title")?.text).toBe("Ocean study");
});

test("rendered layers reflect hierarchy visibility, opacity and paint order", () => {
  const initial = createMarmaladeState();
  const hidden = applyMarmaladeAction(initial, { type: "visibility", id: "caption", visible: false });
  expect(marmaladeLayers(hidden).map((layer) => layer.id)).not.toContain("card");
  expect(marmaladeLayers(initial).at(0)?.id).toBe("artwork");
  const faded = applyMarmaladeAction(initial, { type: "opacity", id: "caption", opacity: 0.5 });
  expect(marmaladeLayers(faded).find((layer) => layer.id === "card")?.opacity).toBe(0.45);
  expect(() => applyMarmaladeAction(initial, { type: "opacity", id: "title", opacity: 2 })).toThrow();
});

test("public JSON edits reject invalid text and toggle values without mutating the document", () => {
  const initial = createMarmaladeState();
  const original = structuredClone(initial);
  expect(() => applyMarmaladeAction(initial, { type: "visibility", id: "artwork", visible: "no" } as never)).toThrow();
  expect(() => applyMarmaladeAction(initial, { type: "lock", id: "artwork", locked: "yes" } as never)).toThrow();
  expect(() => applyMarmaladeAction(initial, { type: "text", id: "title", text: 7 } as never)).toThrow();
  expect(initial).toEqual(original);
});

test("absolute positions use the current host state instead of accumulating stale inspector deltas", () => {
  const initial = createMarmaladeState();
  const first = applyMarmaladeAction(initial, { type: "position", id: "caption", x: 61 });
  const second = applyMarmaladeAction(first, { type: "position", id: "caption", x: 62 });
  expect(second.document.layers.find((layer) => layer.id === "caption")?.x).toBe(62);
  expect(second.document.layers.find((layer) => layer.id === "title")?.x).toBe(87);
});
