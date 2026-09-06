import { expect, test } from "bun:test";
import { createLayoutModel } from "./layout-model";

test("mode region policy applies before a placement opens", () => {
  const layout = createLayoutModel({
    getRegionSettings: (region) =>
      region === "sidenav" ? { collapsible: false, size: { defaultPx: 240 } } : undefined,
  });
  expect(layout.getRegionCollapsible("sidenav")).toBe(false);
  expect(layout.getRegionSize("sidenav")).toEqual({ defaultPx: 240 });
});
