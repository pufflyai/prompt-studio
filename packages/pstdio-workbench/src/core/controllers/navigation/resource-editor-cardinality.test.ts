import { expect, test } from "bun:test";
import { harness, navigate, page, resource } from "../composition/placement-lifecycle-test-support";

test.each([
  undefined,
  "per-resource",
] as const)("reusing a single-cardinality mode binding validates open intent with policy %s", async (policy) => {
  const w = harness();
  w.views.getView("editor")!.instancePolicy = policy;
  const panel = { kind: "placement" as const, extensionId: "test", id: "single" };
  w.modePlacements.registerPlacement({
    id: "single",
    ref: panel,
    modeId: "edit",
    region: "side",
    item: {
      kind: "binding",
      binding: {
        kinds: [{ kind: "resource-kind", id: "file" }],
        view: { kind: "view", id: "editor" },
        cardinality: "one",
      },
    },
  });
  await w.navigation.openTarget(navigate("alpha"));
  const target = { kind: "panel" as const, panel, resource: resource("a") };
  await w.navigation.openTarget(target);
  const layout = w.layout.getLayout();
  await expect(w.navigation.openTarget({ ...target, open: "pin" })).rejects.toThrow(/many cardinality/);
  expect(w.layout.getLayout()).toBe(layout);
});

test("reusing a single-cardinality Main document validates open intent", () => {
  const w = harness();
  w.views.getView("editor")!.instancePolicy = "per-resource";
  w.pages.registerPage({
    id: "collection",
    ref: page("collection"),
    path: "collection",
    modeId: "edit",
    main: { kind: "view", view: { kind: "view", id: "empty" }, cardinality: "one" },
    slots: [],
  });
  w.pages.registerPage({
    parentId: "collection",
    id: "single",
    ref: page("single"),
    path: "single",
    modeId: "edit",
    resource: { kinds: [{ kind: "resource-kind", id: "file" }] },
    main: { kind: "view", view: { kind: "view", id: "editor" }, cardinality: "one" },
    slots: [],
  });
  const target = { kind: "page" as const, page: page("single"), resource: resource("a") };
  expect(w.pageLocations.navigate(target).ok).toBe(true);
  const layout = w.layout.getLayout();
  expect(w.pageLocations.navigate({ ...target, open: "pin" }).ok).toBe(false);
  expect(w.layout.getLayout()).toBe(layout);
});
