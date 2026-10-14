import { expect, test } from "bun:test";
import { createWorkbench } from "../../workbench-core";

test.each([
  undefined,
  "active",
  "keep-mounted",
] as const)("view background %s becomes the placement mount policy", (background) => {
  const core = createWorkbench();
  core.views.registerView({
    id: "view",
    title: "View",
    background,
    reveal: "explicit",
    body: { kind: "react", render: () => null },
  });
  core.shellPlacements.registerPlacement({
    id: "tool",
    region: "side",
    item: { kind: "view", view: { kind: "view", id: "view" }, presence: "open" },
  });
  expect(core.layout.getLayout().regions.side.widgets[0]).toMatchObject({
    mountStrategy: background,
    hiddenByDefault: true,
  });
});

test("legacy placement presentation overrides view defaults without changing old declarations", () => {
  const core = createWorkbench();
  core.views.registerView({
    id: "view",
    title: "View",
    background: "keep-mounted",
    reveal: "explicit",
    body: { kind: "react", render: () => null },
  });
  core.shellPlacements.registerPlacement({
    id: "tool",
    region: "side",
    mountStrategy: "active",
    hiddenByDefault: false,
    item: { kind: "view", view: { kind: "view", id: "view" }, presence: "open" },
  });
  expect(core.layout.getLayout().regions.side.widgets[0]).toMatchObject({
    mountStrategy: "active",
    hiddenByDefault: false,
  });
});
