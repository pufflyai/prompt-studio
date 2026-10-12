import { expect, test } from "bun:test";
import { createDefaultWorkbenchLayout, type WorkbenchLayout } from "../../registries/layout/layout-model";
import { createWorkbench } from "../../workbench-core";
import { harness, navigate } from "../composition/placement-lifecycle-test-support";

test("page geometry is shared by page type while mode geometry follows the mode", async () => {
  const saved = new Map();
  const w = harness(saved);
  await w.navigation.openTarget(navigate("alpha"));
  w.layout.setRegionSize("bottom", 171);
  w.layout.setRegionSize("secondary", 290);
  await w.navigation.openTarget(navigate("beta"));
  expect(w.layout.getLayout().regions.bottom.size).toBe(171);
  expect(w.layout.getLayout().regions.secondary.size).toBe(290);
  w.layout.setRegionSize("bottom", 213);
  await w.navigation.openTarget(navigate("alpha"));
  expect(w.layout.getLayout().regions.bottom.size).toBe(213);
  const restored = harness(saved);
  await restored.navigation.openTarget(navigate("beta"));
  expect(restored.layout.getLayout().regions.bottom.size).toBe(213);
  expect(restored.layout.getLayout().regions.secondary.size).toBe(290);
  await w.dispose();
  await restored.dispose();
});

test("page navigation restores a shared mode layout written before page bottom existed", async () => {
  const layout = createDefaultWorkbenchLayout();
  const regions: Partial<WorkbenchLayout["regions"]> = { ...layout.regions };
  for (const region of ["bottom", "bottom-header", "bottom-left-menu", "bottom-right-menu"] as const)
    delete regions[region];
  const saved = new Map<string | undefined, WorkbenchLayout>([
    ["project/project/owner/mode/project", { ...layout, regions: regions as WorkbenchLayout["regions"] }],
  ]);
  const w = createWorkbench({
    layoutPersistence: {
      getLayout: (scope) => saved.get(scope),
      setLayout: (layout, scope) => {
        saved.set(scope, layout);
      },
    },
  });
  w.modes.registerMode({ id: "project", activate() {} });
  w.views.registerView({ id: "tools", title: "Tools", body: { kind: "react", render: () => null } });
  const page = { kind: "page", extensionId: "test", id: "page" } as const;
  w.pages.registerPage({
    id: "page",
    ref: page,
    path: "page",
    modeId: "project",
    main: { kind: "panels", empty: { kind: "view", id: "tools" } },
    slots: [],
  });
  w.pageLocations.setProject("project");
  await w.navigation.openTarget({ kind: "page", page });
  expect(w.layout.getLayout().regions.main.widgets).toHaveLength(1);
  expect(w.layout.getLayout().regions.bottom.widgets).toEqual([]);
  await w.dispose();
});
