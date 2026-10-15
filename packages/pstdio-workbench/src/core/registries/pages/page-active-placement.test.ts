import { expect, test } from "bun:test";
import { createWorkbench } from "../../workbench-core";
import { resolvePageActivePlacement } from "./page-active-placement";

test("a routed resource view exposes its placement presentation to breadcrumbs", () => {
  const workbench = createWorkbench();
  workbench.modes.registerMode({ id: "project", label: "Project", activate() {} });
  workbench.views.registerView({ id: "editor", title: "Editor", body: { kind: "react", render: () => null } });
  const page = {
    id: "note",
    ref: { kind: "page" as const, id: "note", extensionId: "test" },
    path: "note",
    modeId: "project",
    resource: { kinds: [{ kind: "resource-kind" as const, id: "note" }] },
    parentId: "notes",
    main: { kind: "view" as const, view: { kind: "view" as const, id: "editor" }, cardinality: "one" as const },
    slots: [],
  };
  workbench.layout.getLayout().regions.main.widgets.push({
    widgetId: "note-b",
    contributionId: "editor",
    resource: { type: "note", id: "b" },
    placementIdentity: { kind: "page", pageId: "note", slotId: "$main", instanceKey: "one" },
  });
  expect(resolvePageActivePlacement(workbench.layout.getLayout(), page)?.resource?.id).toBe("b");
});
