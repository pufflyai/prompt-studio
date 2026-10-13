import { expect, test } from "bun:test";
import type { WorkbenchLayout } from "../../registries/layout/layout-types";
import { createWorkbench } from "../../workbench-core";

test("mode activation clamps persisted panel size to destination bounds", async () => {
  let saved: WorkbenchLayout | undefined;
  const layoutPersistence = {
    getLayout: () => saved,
    setLayout: (value: WorkbenchLayout) => {
      saved = structuredClone(value);
    },
  };
  const original = createWorkbench({ layoutPersistence });
  original.layout.setRegionSize("secondary", 600);
  await original.dispose();
  const core = createWorkbench({ layoutPersistence });
  core.modes.registerMode({
    id: "fixed",
    regionSettings: { secondary: { size: { defaultPx: 188, minPx: 188, maxPx: 188 } } },
    activate() {},
  });
  core.modes.setActiveMode("fixed");
  expect(core.layout.getLayout().regions.secondary.size).toBe(188);
  expect(core.shell.getRegionState("secondary").size).toBe(188);
  await core.dispose();
});

test("mode panel settings retain inherited host size bounds", async () => {
  let saved: WorkbenchLayout | undefined;
  const layoutPersistence = {
    getLayout: () => saved,
    setLayout: (value: WorkbenchLayout) => {
      saved = structuredClone(value);
    },
  };
  const original = createWorkbench({ layoutPersistence });
  original.layout.setRegionSize("secondary", 600);
  await original.dispose();
  const core = createWorkbench({ layoutPersistence, regionSettings: { secondary: { size: { maxPx: 300 } } } });
  core.modes.registerMode({ id: "mode", regionSettings: { secondary: { alwaysShowTabs: true } }, activate() {} });
  core.modes.setActiveMode("mode");
  expect(core.layout.getLayout().regions.secondary.size).toBe(300);
  await core.dispose();
});

test("page navigation applies destination bottom bounds before the page is published", async () => {
  const core = createWorkbench();
  core.modes.registerMode({ id: "large", activate() {} });
  core.modes.registerMode({ id: "fixed", activate() {} });
  core.views.registerView({ id: "view", title: "View", body: { kind: "react", render: () => null } });
  const ref = (id: string) => ({ kind: "page" as const, extensionId: "test", id });
  const registerPage = (id: string, fixed = false) =>
    core.pages.registerPage({
      id,
      ref: ref(id),
      path: id,
      modeId: id,
      main: { kind: "view", view: { kind: "view", id: "view" }, cardinality: "one" },
      regionSettings: { bottom: { size: fixed ? { minPx: 188, maxPx: 188 } : { minPx: 200, maxPx: 800 } } },
      slots: [
        {
          id: "bottom",
          region: "bottom",
          item: { kind: "view", view: { kind: "view", id: "view" }, presence: "fixed" },
        },
      ],
    });
  registerPage("large");
  const destination = registerPage("fixed");
  core.pageLocations.setProject("project");
  await core.navigation.openTarget({ kind: "page", page: ref("fixed") });
  core.shell.setRegionSize("bottom", 600);
  await core.navigation.openTarget({ kind: "page", page: ref("large") });
  destination.dispose();
  registerPage("fixed", true);
  await core.navigation.openTarget({ kind: "page", page: ref("fixed") });
  expect(core.shell.getRegionState("bottom").size).toBe(188);
  await core.dispose();
});
