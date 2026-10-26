import { expect, test } from "bun:test";
import type { WorkbenchLayout } from "../../registries/layout/layout-types";
import { harness, navigate, page, panel, resource } from "./placement-lifecycle-test-support";

test("shared resources remain isolated across projects and modes after restart", async () => {
  const saved = new Map<string | undefined, WorkbenchLayout>();
  function create() {
    const w = harness(saved);
    w.modes.registerMode({ id: "other", activate() {} });
    w.pages.registerPage({
      id: "other",
      ref: page("other"),
      path: "other",
      modeId: "other",
      main: { kind: "view", view: { kind: "view", id: "editor" }, cardinality: "one" },
      slots: [],
    });
    w.modePlacements.registerPlacement({
      id: "other-shared",
      ref: { kind: "placement", extensionId: "test", id: "other-shared" },
      modeId: "other",
      region: "side",
      item: {
        kind: "binding",
        binding: {
          kinds: [{ kind: "resource-kind", id: "file" }],
          view: { kind: "view", id: "editor" },
          cardinality: "many",
        },
      },
    });
    return w;
  }
  const w = create();
  const ids = () => w.layout.getLayout().regions.side.widgets.map((p) => p.resource?.id);
  await w.navigation.openTarget(navigate("alpha"));
  await w.navigation.openTarget({ kind: "panel", panel, resource: resource("project-one-edit"), open: "pin" });
  await w.navigation.openTarget({ kind: "page", page: page("other") });
  await w.navigation.openTarget({
    kind: "panel",
    panel: { kind: "placement", extensionId: "test", id: "other-shared" },
    resource: resource("project-one-other"),
    open: "pin",
  });
  expect(ids()).toEqual(["project-one-other"]);
  await w.navigation.openTarget(navigate("alpha"));
  expect(ids()).toEqual(["project-one-edit"]);
  w.pageLocations.setProject("project-two");
  await w.navigation.openTarget(navigate("alpha"));
  expect(ids()).toEqual([]);
  await w.navigation.openTarget({ kind: "panel", panel, resource: resource("project-two-edit"), open: "pin" });
  w.pageLocations.setProject("project");
  await w.navigation.openTarget(navigate("alpha"));
  expect(ids()).toEqual(["project-one-edit"]);
  const restored = create();
  await restored.navigation.openTarget({ kind: "page", page: page("other") });
  expect(restored.layout.getLayout().regions.side.widgets.map((p) => p.resource?.id)).toEqual(["project-one-other"]);
});
