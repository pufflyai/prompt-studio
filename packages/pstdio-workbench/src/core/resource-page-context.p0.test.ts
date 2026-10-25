import { expect, test } from "bun:test";
import { createWorkbench } from "./workbench-core";

test("resource providers use routed page context while Main renders another resource", () => {
  const core = createWorkbench();
  core.modes.registerMode({ id: "project", activate: () => undefined });
  for (const id of ["empty", "editor"])
    core.views.registerView({ id, title: id, body: { kind: "react", render: () => null } });
  const page = { kind: "page" as const, extensionId: "acme.editor", id: "workspace" };
  core.pages.registerPage({
    id: "workspace",
    ref: page,
    path: "workspace",
    modeId: "project",
    resource: { kinds: [{ kind: "resource-kind", id: "workspace" }] },
    main: { kind: "panels", empty: { kind: "view", id: "empty" } },
    slots: [
      {
        id: "files",
        region: "main",
        item: {
          kind: "binding",
          binding: {
            kinds: [{ kind: "resource-kind", id: "file" }],
            view: { kind: "view", id: "editor" },
            cardinality: "many",
          },
        },
      },
    ],
  });
  const workspace = { type: "workspace", id: "ws-1" };
  core.pageLocations.setProject("project-1");
  expect(core.pageLocations.navigate({ kind: "page", page, resource: workspace })).toMatchObject({ ok: true });
  core.pages.openSlot({ pageId: "workspace", slotId: "files", resource: { type: "file", id: "notes.ts" } });
  core.resources.registerProvider({
    id: "context",
    kind: "file",
    list: (_query, context) => {
      expect(context.primary).toEqual(workspace);
      return [];
    },
  });
  core.resources.listResources("");
  expect(core.getPrimaryResource()).toEqual(workspace);
});
