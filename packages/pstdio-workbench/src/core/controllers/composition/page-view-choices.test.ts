import { expect, test } from "bun:test";
import { createWorkbench } from "../../workbench-core";

test.each([
  "main",
  "side",
] as const)("page views declared in %s only offer Main creation within their page", async (region) => {
  const workbench = createWorkbench();
  const view = { kind: "view", id: "browser" } as const;
  const panel = { kind: "placement", extensionId: "example.browser", id: "browser" } as const;
  const page = { kind: "page", extensionId: "example.browser", id: "browser" } as const;
  const unrelated = { kind: "page", extensionId: "example.documents", id: "documents" } as const;
  workbench.views.registerView({ id: view.id, title: "Browser", body: { kind: "react", render: () => null } });
  workbench.modes.registerMode({ id: "project", activate() {} });
  workbench.modePlacements.registerPlacement({
    id: panel.id,
    ref: panel,
    modeId: "project",
    region,
    item: { kind: "view", view, presence: "closed" },
  });
  for (const ref of [page, unrelated])
    workbench.pages.registerPage({
      id: ref.id,
      ref,
      path: ref.id,
      modeId: "project",
      main: { kind: "panels" },
      panelView: ref === page ? panel : undefined,
      slots: [],
    });
  workbench.pageLocations.setProject("project");
  workbench.pageLocations.navigate({ kind: "page", page });
  expect(workbench.composition.panelsFor("main").addable).toHaveLength(1);
  workbench.pageLocations.navigate({ kind: "page", page: unrelated });
  expect(workbench.composition.panelsFor("main").addable).toHaveLength(0);
  const side = workbench.composition.panelsFor("side").addable;
  expect(side).toHaveLength(1);
  await side[0]!.open!();
  const opened = workbench.layout.getActivePanel("side")!;
  workbench.movePanel(opened.instanceId, "main");
  expect(workbench.layout.getActivePanel("main")?.instanceId).toBe(opened.instanceId);
  expect(workbench.pages.store.getState().activePageId).toBe(unrelated.id);
});

test("resource viewers remain available in another collection's Main", () => {
  const workbench = createWorkbench();
  workbench.views.registerView({ id: "reader", title: "Reader", body: { kind: "react", render: () => null } });
  workbench.commands.registerCommand({ id: "new-document", label: "New document" }, { execute() {} });
  workbench.modes.registerMode({ id: "project", activate() {} });
  const panel = { kind: "placement", extensionId: "example", id: "reader" } as const;
  workbench.modePlacements.registerPlacement({
    id: "reader",
    ref: panel,
    modeId: "project",
    region: "side",
    item: {
      kind: "binding",
      binding: {
        kinds: [{ kind: "resource-kind", id: "document" }],
        view: { kind: "view", id: "reader" },
        cardinality: "many",
        add: { kind: "command", target: { command: { kind: "command", id: "new-document" } } },
      },
    },
  });
  const page = { kind: "page", extensionId: "example", id: "reader" } as const;
  const collection = { ...page, id: "collection" };
  workbench.pages.registerPage({
    id: page.id,
    ref: page,
    path: "reader",
    modeId: "project",
    panelView: panel,
    main: { kind: "view", view: { kind: "view", id: "reader" }, cardinality: "one", presentation: "page" },
    slots: [],
  });
  workbench.pages.registerPage({
    id: collection.id,
    ref: collection,
    path: "collection",
    modeId: "project",
    main: { kind: "panels" },
    slots: [],
  });
  workbench.pageLocations.setProject("project");
  workbench.pageLocations.navigate({ kind: "page", page: collection });
  expect(workbench.composition.panelsFor("main").addable.map((item) => item.contribution.title)).toContain(
    "New document",
  );
});
