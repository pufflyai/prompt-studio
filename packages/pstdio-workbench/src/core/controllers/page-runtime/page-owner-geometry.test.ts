import { expect, test } from "bun:test";
import type { WorkbenchLayout } from "../../registries/layout/layout-types";
import { harness, page } from "../composition/placement-lifecycle-test-support";

const tools = page("bottom-tools");
const create = (saved: Map<string | undefined, WorkbenchLayout>) => {
  const w = harness(saved);
  for (const side of ["left", "right"] as const)
    w.viewMenus.registerViewMenu({
      id: `tools-${side}`,
      ownerViewId: "editor",
      viewId: "editor",
      side,
      regionSize: { defaultPx: 200, minPx: 100 },
    });
  w.pages.registerPage({
    id: "bottom-tools",
    ref: tools,
    path: "bottom-tools",
    modeId: "edit",
    resource: { kinds: [{ kind: "resource-kind", id: "workspace" }] },
    main: { kind: "panels", empty: { kind: "view", id: "empty" } },
    slots: [
      {
        id: "tools",
        region: "bottom",
        item: { kind: "view", presence: "fixed", view: { kind: "view", id: "editor" } },
      },
    ],
  });
  return w;
};
const open = (w: ReturnType<typeof create>, id: string) =>
  w.navigation.openTarget({ kind: "page", page: tools, resource: { type: "workspace", id } });

test("page bottom menu widths follow the page type across instances and fresh restoration", async () => {
  const saved = new Map<string | undefined, WorkbenchLayout>();
  const w = create(saved);
  await open(w, "alpha");
  expect(w.layout.getLayout().regions["bottom-left-menu"].widgets.length).toBeGreaterThan(0);
  w.layout.setRegionSize("bottom-left-menu", 333);
  w.layout.setRegionSize("bottom-right-menu", 344);
  await open(w, "beta");
  expect(w.layout.getLayout().regions["bottom-left-menu"].size).toBe(333);
  expect(w.layout.getLayout().regions["bottom-right-menu"].size).toBe(344);
  for (const [scope, layout] of saved) saved.set(scope, JSON.parse(JSON.stringify(layout)));
  const restored = create(saved);
  await open(restored, "gamma");
  expect(restored.layout.getLayout().regions["bottom-left-menu"].size).toBe(333);
  expect(restored.layout.getLayout().regions["bottom-right-menu"].size).toBe(344);
});
