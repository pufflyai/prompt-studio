import { expect, test } from "bun:test";
import type { PageRef } from "@pstdio/sdk/extensions";
import type { WorkbenchLayout } from "../../registries/layout/layout-types";
import { createWorkbench } from "../../workbench-core";

const page = (id: string): PageRef => ({ kind: "page", extensionId: "test", id });
const harness = (persist = true) => {
  const layouts = new Map<string | undefined, WorkbenchLayout>();
  const workbench = createWorkbench({
    startPage: page("home"),
    layoutPersistence: persist
      ? {
          getLayout: (scope) => layouts.get(scope),
          setLayout: (layout, scope) => layouts.set(scope, layout),
        }
      : undefined,
  });
  workbench.modes.registerMode({ id: "project", activate: () => undefined });
  workbench.views.registerView({ id: "content", title: "Content", body: { kind: "react", render: () => null } });
  workbench.pages.registerPage({
    id: "home",
    ref: page("home"),
    path: "home",
    modeId: "project",
    main: { kind: "view", view: { kind: "view", id: "content" }, cardinality: "one" },
    slots: [],
  });
  workbench.pageLocations.switchProject("p1");
  return workbench;
};

test("a compound open adds and selects a resource when returning to a saved empty collection", async () => {
  const workbench = harness();
  workbench.pages.registerPage({
    id: "notes",
    ref: page("notes"),
    path: "notes",
    modeId: "project",
    main: { kind: "panels", empty: { kind: "view", id: "content" } },
    slots: [
      {
        id: "note",
        region: "main",
        item: {
          kind: "binding",
          binding: {
            kinds: [{ kind: "resource-kind", id: "note" }],
            view: { kind: "view", id: "content" },
            cardinality: "many",
          },
        },
      },
    ],
  });
  workbench.pageLocations.navigate({ kind: "page", page: page("notes") });
  workbench.pageLocations.navigate({ kind: "page", page: page("home") });
  await workbench.navigation.openTarget({
    kind: "compound",
    targets: [
      { kind: "page", page: page("notes") },
      {
        kind: "panel",
        panel: { kind: "page-slot", page: page("notes"), id: "note" },
        resource: { type: "note", id: "new" },
        open: "pin",
      },
    ],
  });
  const layout = workbench.layout.getLayout();
  const note = layout.regions.main.widgets.find((widget) => widget.resource?.id === "new");
  expect(note).toBeDefined();
  expect(layout.regions.main.activeWidgetId).toBe(note?.widgetId);
});

test.each([true, false])("a single-resource Main keeps its rendered instance with persistence %p", (persist) => {
  const workbench = harness(persist);
  const home = workbench.layout.getLayout().regions.main.widgets[0]!;
  workbench.pages.registerPage({
    id: "reader",
    ref: page("reader"),
    path: "reader",
    modeId: "project",
    parentId: "home",
    resource: { kinds: [{ kind: "resource-kind", id: "file" }] },
    main: { kind: "view", view: { kind: "view", id: "content" }, cardinality: "one" },
    slots: [],
  });
  const open = (id: string) =>
    workbench.pageLocations.navigate({ kind: "page", page: page("reader"), resource: { type: "file", id } });
  expect(open("first").ok).toBe(true);
  const first = workbench.layout.getLayout().regions.main.widgets[0]!;
  expect(first.widgetId).toBe(home.widgetId);
  expect(open("second").ok).toBe(true);
  const second = workbench.layout.getLayout().regions.main.widgets[0]!;
  expect(second.widgetId).toBe(first.widgetId);
  expect(second.resource?.id).toBe("second");
  workbench.pageLocations.goBack();
  expect(workbench.layout.getLayout().regions.main.widgets[0]!.widgetId).toBe(home.widgetId);
  expect(workbench.layout.getLayout().regions.main.widgets[0]!.resource?.id).toBe("first");
  workbench.pageLocations.goForward();
  workbench.pageLocations.navigate({ kind: "page", page: page("home") });
  expect(workbench.layout.getLayout().regions.main.widgets[0]!.widgetId).toBe(home.widgetId);
  workbench.pages.registerPage({
    id: "unrelated",
    ref: page("unrelated"),
    path: "unrelated",
    modeId: "project",
    main: { kind: "view", view: { kind: "view", id: "content" }, cardinality: "one" },
    slots: [],
  });
  workbench.pageLocations.navigate({ kind: "page", page: page("unrelated") });
  expect(workbench.layout.getLayout().regions.main.widgets[0]!.widgetId).not.toBe(home.widgetId);
});

test("a child Main gets its own view while a transferred parent remains owned by the mode", () => {
  const workbench = harness();
  const home = workbench.layout.getLayout().regions.main.widgets[0]!;
  workbench.movePanel(home.widgetId, "side");
  workbench.pages.registerPage({
    id: "reader",
    ref: page("reader"),
    path: "reader",
    modeId: "project",
    parentId: "home",
    resource: { kinds: [{ kind: "resource-kind", id: "file" }] },
    main: { kind: "view", view: { kind: "view", id: "content" }, cardinality: "one" },
    slots: [],
  });
  const open = (id: string) =>
    workbench.pageLocations.navigate({ kind: "page", page: page("reader"), resource: { type: "file", id } });
  expect(open("first").ok).toBe(true);
  const first = workbench.layout.getLayout().regions.main.widgets[0]!;
  const transferred = workbench.layout.getLayout().regions.side.widgets[0]!;
  expect(transferred.widgetId).toBe(home.widgetId);
  expect(transferred.resource).toBeUndefined();
  expect(first.widgetId).not.toBe(transferred.widgetId);
  expect(first.resource?.id).toBe("first");
  expect(open("second").ok).toBe(true);
  expect(workbench.layout.getLayout().regions.main.widgets[0]!.widgetId).toBe(first.widgetId);
  expect(workbench.layout.getLayout().regions.main.widgets[0]!.resource?.id).toBe("second");
  workbench.movePanel(first.widgetId, "side");
  expect(open("third").ok).toBe(true);
  const layout = workbench.layout.getLayout();
  expect(layout.regions.side.widgets.map((p) => p.widgetId)).toEqual([home.widgetId, first.widgetId]);
  expect(layout.regions.main.widgets[0]!.resource?.id).toBe("third");
  expect(new Set(Object.values(layout.regions).flatMap((r) => r.widgets.map((p) => p.widgetId))).size).toBe(3);
});
