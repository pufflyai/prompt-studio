import { describe, expect, test } from "bun:test";
import { createWorkbench, getWorkbenchRenderers } from "../../core";
import { registerWorkbenchExtensionDataTableRenderers } from "./data-table-renderer-contributions";
import { registerWorkbenchExtensionKanbanRenderers } from "./kanban-renderer-contributions";

describe("row activation navigation", () => {
  test.each(["table", "kanban"])("applies explicit %s navigation once and preserves result data", async (kind) => {
    const page = { kind: "page", extensionId: "acme.items", id: "details" } as const;
    const workbench = createWorkbench();
    workbench.modes.registerMode({ id: "project", activate: () => undefined });
    workbench.views.registerView({ id: "details", title: "Details", body: { kind: "react", render: () => null } });
    workbench.pages.registerPage({
      id: "details",
      ref: page,
      path: "details",
      modeId: "project",
      main: { kind: "view", view: { kind: "view", id: "details" }, cardinality: "one" },
      slots: [],
    });
    workbench.pageLocations.setProject("project-1");
    let navigations = 0;
    workbench.commands.registerCommand(
      { id: "record-navigation", label: "Record navigation" },
      {
        execute: () => {
          navigations++;
        },
      },
    );
    const calls: string[] = [];
    const context = {
      projectId: "project-1",
      workbench,
      executeCommand: (commandId: string) => {
        calls.push(commandId);
        return {
          outcome: {
            ok: true,
            status: "success",
            value: { kind: "page", page },
            navigationRequests: [
              {
                kind: "command",
                target: { command: { kind: "command", id: "record-navigation", extensionId: "pstdio" } },
              },
            ],
          },
        };
      },
    };
    const record = {
      id: "items",
      title: "Items",
      extensionId: "acme.items",
      queryHandlerId: "items.query",
      rowActivationHandlerId: "items.activate",
    };
    const row = { id: "item-1", title: "Item", values: {}, attributes: {}, resource: { type: "item", id: "item-1" } };
    if (kind === "table") {
      registerWorkbenchExtensionDataTableRenderers(context, [record]);
      await getWorkbenchRenderers(workbench).getDataTableRenderer("items")!.onRowActivate!(row);
    } else {
      registerWorkbenchExtensionKanbanRenderers(context, [record]);
      await getWorkbenchRenderers(workbench).getKanbanRenderer("items")!.onRowActivate!(row);
    }
    expect(calls).toEqual(["items.activate"]);
    expect(navigations).toBe(1);
    expect(workbench.pages.store.getState().activePageId).not.toBe("details");
  });
});
