import { expect, test } from "bun:test";
import { readDataTableImageValue } from "../extension-kernel/data-table-image-values";
import { resolveDataTableComparableValue, resolveDataTableFieldKind } from "../extension-kernel/data-table-values";
import type { DataTableRendererImageValue, DataTableRendererRow } from "../extension-kernel/types/data-table-renderer";
import { dataTableRendererColumnSchema } from "./data-table-renderer";

test("native tables accept image columns with fit, shape and label options", () => {
  const column = {
    id: "photo",
    renderer: { type: "image", fit: "contain", shape: "circle", showLabel: true },
  } as const;
  expect(dataTableRendererColumnSchema.parse(column)).toEqual(column);
  expect(() =>
    dataTableRendererColumnSchema.parse({ id: "photo", renderer: { type: "image", fit: "fill" } }),
  ).toThrow();
});

test("an image cell holds a URL, an image with alt text, or a gallery of both", () => {
  expect(readDataTableImageValue("https://example.com/a.png")).toEqual([{ src: "https://example.com/a.png" }]);
  expect(readDataTableImageValue({ src: "data:image/png;base64,AA", alt: "Shoe" })).toEqual([
    { src: "data:image/png;base64,AA", alt: "Shoe" },
  ]);
  expect(readDataTableImageValue(["a.png", { src: "b.png", alt: "Back" }, 3, { alt: "no source" }])).toEqual([
    { src: "a.png" },
    { src: "b.png", alt: "Back" },
  ]);
  expect(readDataTableImageValue(null)).toEqual([]);
  expect(readDataTableImageValue("")).toEqual([]);
});

test("image columns sort, filter and search by alt text, then file name", () => {
  const photos: DataTableRendererImageValue = [
    { src: "https://cdn.example.com/shoes/side.png?size=2", alt: "Side view" },
    "https://cdn.example.com/shoes/back.jpg",
  ];
  const row: DataTableRendererRow = { id: "shoe", values: { photos } };
  expect(resolveDataTableComparableValue(row.values.photos, { type: "image" })).toBe("Side view, back.jpg");
  expect(resolveDataTableComparableValue("https://cdn.example.com/logo.svg", { type: "image" })).toBe("logo.svg");
  expect(resolveDataTableComparableValue(null, { type: "image" })).toBeNull();
  expect(resolveDataTableFieldKind([photos], { renderer: { type: "image" } })).toBe("string");
});
