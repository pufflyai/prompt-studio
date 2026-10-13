import { expect, test } from "bun:test";
import type { WorkbenchLayout } from "../../registries/layout/layout-types";
import { harness, page } from "./placement-lifecycle-test-support";

for (const reload of [false, true]) {
  test(`a fixed page tool stays in its destination page after returning to its source (reload=${reload})`, async () => {
    const saved = new Map<string | undefined, WorkbenchLayout>();
    const create = () => {
      const w = harness(saved);
      w.pages.registerPage({
        id: "tools",
        ref: page("tools"),
        path: "tools",
        modeId: "edit",
        resource: { kinds: [{ kind: "resource-kind", id: "workspace" }] },
        main: { kind: "panels", empty: { kind: "view", id: "empty" } },
        slots: [
          {
            id: "fixed",
            region: "main",
            item: { kind: "view", view: { kind: "view", id: "editor" }, presence: "fixed" },
          },
        ],
      });
      return w;
    };
    const open = (w: ReturnType<typeof harness>, id: string) =>
      w.navigation.openTarget({ kind: "page", page: page("tools"), resource: { type: "workspace", id } });
    let w = create();
    await open(w, "alpha");
    const original = w.layout.getLayout().regions.main.widgets[0]!;
    w.movePanel(original.widgetId, "side");
    await open(w, "beta");
    w.movePanel(original.widgetId, "main");
    const moved = w.layout.getLayout().regions.main.widgets.find((p) => p.widgetId === original.widgetId)!;
    if (reload) {
      await w.dispose();
      for (const [scope, layout] of saved) saved.set(scope, JSON.parse(JSON.stringify(layout)));
      w = create();
    }
    await open(w, "alpha");
    expect(
      w.layout.getLayout().regions.main.widgets.filter((p) => p.contributionId === original.contributionId),
    ).toHaveLength(0);
    await open(w, "beta");
    const destination = Object.values(w.layout.getLayout().regions)
      .flatMap((r) => r.widgets)
      .filter((p) => p.widgetId === original.widgetId);
    expect(destination).toHaveLength(1);
    expect(destination[0]?.placementIdentity).toEqual(moved.placementIdentity);
    expect(destination[0]?.viewId).toBe(original.viewId);
    await w.dispose();
  });
}
