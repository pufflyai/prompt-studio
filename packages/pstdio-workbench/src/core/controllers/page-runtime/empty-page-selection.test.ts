import { expect, test } from "bun:test";
import { createWorkbench } from "../../workbench-core";

test("navigating to an empty page clears the departed tab's active resource", () => {
  const workbench = createWorkbench();
  workbench.modes.registerMode({ id: "project", activate() {} });
  workbench.views.registerView({ id: "editor", title: "Editor", body: { kind: "react", render: () => null } });
  const home = { kind: "page" as const, extensionId: "example", id: "home" };
  const empty = { kind: "page" as const, extensionId: "example", id: "empty" };
  const document = { kind: "page" as const, extensionId: "example", id: "document" };
  workbench.pages.registerPage({
    id: "home",
    ref: home,
    path: "",
    modeId: "project",
    main: { kind: "panels" },
    slots: [],
  });
  workbench.pages.registerPage({
    id: "document",
    ref: document,
    parentId: "home",
    path: "document",
    modeId: "project",
    resource: { kinds: [{ kind: "resource-kind", id: "document" }] },
    main: { kind: "view", view: { kind: "view", id: "editor" }, cardinality: "one" },
    slots: [],
  });
  workbench.pages.registerPage({
    id: "empty",
    ref: empty,
    path: "empty",
    modeId: "project",
    main: { kind: "panels" },
    slots: [],
  });
  workbench.pageLocations.setProject("project");
  workbench.pageLocations.navigate({ kind: "page", page: home });
  workbench.pageLocations.navigate({ kind: "page", page: document, resource: { type: "document", id: "first" } });
  expect(workbench.layout.getActivePanel("main")?.resource?.id).toBe("first");
  expect(workbench.pageLocations.navigate({ kind: "page", page: empty }).ok).toBe(true);
  expect(workbench.layout.getLayout().regions.main.widgets).toHaveLength(0);
  expect(workbench.layout.getLayout().activeResourceKey).toBeUndefined();
  expect(workbench.layout.getLayout().activeWidgetId).toBeUndefined();
});
