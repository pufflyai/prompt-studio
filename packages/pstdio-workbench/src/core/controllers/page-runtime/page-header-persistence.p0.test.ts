import { expect, test } from "bun:test";
import { createDefaultWorkbenchLayout, type WorkbenchLayout } from "../../registries/layout/layout-types";
import type { WorkbenchPageContribution } from "../../registries/pages/page-registry-types";
import { createWorkbenchLayoutCache } from "./workbench-layout-cache";

const page: WorkbenchPageContribution = {
  id: "empty",
  ref: { kind: "page", id: "empty" },
  path: "empty",
  modeId: "project",
  main: { kind: "panels" },
  slots: [],
};
const context = { projectId: "one", modeId: "project", pageId: page.id };

test("locationless modes do not share page header overrides", () => {
  const saved = new Map<string | undefined, WorkbenchLayout>();
  const cache = createWorkbenchLayoutCache({
    layoutPersistence: {
      getLayout: (scope) => saved.get(scope),
      setLayout: (layout, scope) => saved.set(scope, structuredClone(layout)),
    },
  });
  const layout = createDefaultWorkbenchLayout();
  layout.regions.main.headerVisible = false;
  cache.savePageMain({ projectId: "one", modeId: "first" }, layout, undefined);
  expect(cache.loadPageLayout({ projectId: "one", modeId: "second" }, undefined)?.regions.main.headerVisible).not.toBe(
    false,
  );
});

for (const canRemove of [true, false]) {
  test(`page header preferences reset independently with deletion ${canRemove}`, () => {
    const saved = new Map<string | undefined, WorkbenchLayout>();
    const cache = createWorkbenchLayoutCache({
      layoutPersistence: {
        getLayout: (scope) => saved.get(scope),
        setLayout: (layout, scope) => saved.set(scope, structuredClone(layout)),
        ...(canRemove ? { removeLayout: (scope?: string) => void saved.delete(scope) } : {}),
      },
    });
    const layout = createDefaultWorkbenchLayout();
    layout.regions.main.headerVisible = false;
    cache.savePageMain(context, layout, page);
    expect(cache.hasPageMain(context, page)).toBe(false);
    expect(cache.loadPageLayout(context, page)?.regions.main.headerVisible).toBe(false);
    expect(
      cache.loadPageLayout({ ...context, resource: { type: "session", id: "next" } }, page)?.regions.main.headerVisible,
    ).toBe(false);
    expect(cache.loadPageLayout({ ...context, projectId: "two" }, page)).toBeUndefined();
    const other = { ...context, pageId: "other" };
    layout.regions.main.headerVisible = true;
    cache.savePageMain(other, layout, { ...page, id: "other" });
    cache.savePageMain(context, createDefaultWorkbenchLayout(), page);
    expect(cache.loadPageLayout(context, page)?.regions.main.headerVisible).toBeUndefined();
    expect(cache.loadPageLayout(other, page)?.regions.main.headerVisible).toBe(true);
    expect(
      [...saved.values()].every((snapshot) =>
        Object.values(snapshot.regions).every((region) => region.widgets.length === 0),
      ),
    ).toBe(true);
  });
}
