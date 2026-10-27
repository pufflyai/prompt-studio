import { expect, test } from "bun:test";
import { type DesignDocument, expandDesign, resolveDesignValue } from "../src/catalog/pencil/model";

test("component instances preserve nested overrides and their source identities", () => {
  const document: DesignDocument = {
    themes: { mode: ["light", "dark"] },
    variables: {},
    children: [
      { id: "key", type: "frame", children: [{ id: "label", type: "text", content: "K" }] },
      { id: "button", type: "frame", children: [{ id: "shortcut", type: "ref", ref: "key" }] },
      { id: "instance", type: "ref", ref: "button", descendants: { "shortcut/label": { content: "P" } } },
    ],
  };
  const instance = expandDesign(document, "instance");
  expect(instance.id).toBe("instance");
  expect(instance.children?.[0].children?.[0]).toMatchObject({ id: "label", content: "P" });
  expect(document.children[0].children?.[0].content).toBe("K");
});

test("variable aliases select the most specific matching theme", () => {
  const document: DesignDocument = {
    children: [],
    themes: { mode: ["light", "dark"], state: ["rest", "hover"] },
    variables: {
      ink: {
        type: "color",
        value: [
          { value: "#111", theme: { mode: "light" } },
          { value: "#eee", theme: { mode: "dark" } },
        ],
      },
      label: { type: "color", value: [{ value: "$ink" }, { value: "#f00", theme: { mode: "dark", state: "hover" } }] },
    },
  };
  expect(resolveDesignValue(document, "$label", { mode: "dark", state: "rest" })).toBe("#eee");
  expect(resolveDesignValue(document, "$label", { mode: "dark", state: "hover" })).toBe("#f00");
});

test("instance overrides reach nested groups and stay inside their component boundary", () => {
  const document: DesignDocument = {
    themes: {},
    variables: {},
    children: [
      {
        id: "component",
        type: "frame",
        children: [{ id: "group", type: "frame", children: [{ id: "label", type: "text", content: "default" }] }],
      },
      {
        id: "pair",
        type: "frame",
        children: [
          { id: "first", type: "ref", ref: "component" },
          { id: "second", type: "ref", ref: "component" },
        ],
      },
      { id: "instance", type: "ref", ref: "pair", descendants: { "first/label": { content: "changed" } } },
    ],
  };
  const root = expandDesign(document, "instance");
  expect(root.children?.map((child) => child.children?.[0].children?.[0].content)).toEqual(["changed", "default"]);
});
