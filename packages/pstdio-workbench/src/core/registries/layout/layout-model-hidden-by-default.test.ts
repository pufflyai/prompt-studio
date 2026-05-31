import { describe, expect, test } from "bun:test";
import { createLayoutModel } from "./layout-model";
import { registerTestWidget } from "./layout-model-test-utils";

describe("createLayoutModel — hiddenByDefault propagation", () => {
  test("contribution default propagates onto the placement and openWidget can override it", () => {
    const layout = createLayoutModel();
    registerTestWidget(layout, {
      id: "project.hidden-default",
      title: "Hidden by default",
      area: "main",
      singleton: false,
      closable: false,
      hiddenByDefault: true,
    });
    registerTestWidget(layout, {
      id: "project.hidden-override",
      title: "Hidden override",
      area: "main",
      singleton: false,
      closable: false,
      hiddenByDefault: true,
    });

    expect(layout.openWidget("project.hidden-default").hiddenByDefault).toBe(true);
    expect(layout.openWidget("project.hidden-override", { hiddenByDefault: false }).hiddenByDefault).toBe(false);
  });
});
