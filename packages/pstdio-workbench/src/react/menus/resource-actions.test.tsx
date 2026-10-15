import { describe, expect, test } from "bun:test";
import { createWorkbench, type ResourceRef, resourceContextMenuPath } from "../../core";
import { createWorkbenchResourceActions } from "./resource-actions";

const ticket: ResourceRef = {
  type: "ticket",
  id: "PS-179",
  label: "PS-179 Resource actions",
};
const workspace: ResourceRef = {
  type: "workspace",
  id: "PS-179_A1",
  label: "PS-179_A1",
};
describe("createWorkbenchResourceActions", () => {
  test("uses the menu subject for command availability and disabled explanations", () => {
    const workbench = createWorkbench();
    workbench.commands.registerCommand(
      { id: "rename", label: "Rename" },
      {
        execute() {},
        isEnabled: (_args, context) => context?.resource?.id === "b",
        isVisible: (_args, context) => context?.resource?.id === "b",
      },
    );
    workbench.layout.registerMenuItem(resourceContextMenuPath("note"), { commandId: "rename" });
    expect(createWorkbenchResourceActions(workbench, { type: "note", id: "b" })[0]?.isDisabled).toBe(false);
    workbench.layout.registerMenuItem(resourceContextMenuPath("note"), {
      commandId: "rename",
      disabledWhen: 'workbench.resource.metadata.writable == "false"',
      disabledReason: "Notes are read-only.",
    });
    expect(
      createWorkbenchResourceActions(workbench, { type: "note", id: "b", metadata: { writable: false } })[1]
        ?.isDisabled,
    ).toBe(true);
  });
  test("uses current owner data when a tab's reference predates a status change", () => {
    const workbench = createWorkbench();
    const stale = { type: "session", id: "one", metadata: { busy: false } };
    const current = { ...stale, metadata: { busy: true } };
    workbench.resources.registerKind({ kind: "session", label: "Session", resolve: () => current });
    workbench.commands.registerCommand({ id: "delete", label: "Delete" }, { execute() {} });
    workbench.layout.registerMenuItem(resourceContextMenuPath("session"), {
      commandId: "delete",
      when: 'workbench.resource.metadata.busy == "false"',
    });
    expect(createWorkbenchResourceActions(workbench, stale)).toEqual([]);
  });
  test("uses the selected resource context for visibility and execution", async () => {
    const workbench = createWorkbench();
    let openedResource: ResourceRef | undefined;
    workbench.commands.registerCommand(
      { id: "ticket.run", label: "Run attempt", icon: "Play" },
      {
        execute: (_args, context) => {
          openedResource = context?.resource;
        },
      },
    );
    workbench.layout.registerMenuItem(resourceContextMenuPath("ticket"), {
      commandId: "ticket.run",
      sourceCommandId: "pstdio-planner.run-attempt",
      when: 'workbench.resource.type == "ticket"',
    });
    const ticketActions = createWorkbenchResourceActions(workbench, ticket);
    const workspaceActions = createWorkbenchResourceActions(workbench, workspace);
    expect(ticketActions.map((action) => action.label)).toEqual(["Run attempt"]);
    expect(ticketActions.map((action) => action.commandId)).toEqual(["pstdio-planner.run-attempt"]);
    expect(workspaceActions).toEqual([]);
    await ticketActions[0]?.onClick?.();
    expect(openedResource).toEqual(ticket);
  });

  test("reads visibility from the selected resource, not the open page", () => {
    const workbench = createWorkbench();
    workbench.commands.registerCommand({ id: "ticket.unarchive", label: "Unarchive" }, { execute: () => undefined });
    workbench.layout.registerMenuItem(resourceContextMenuPath("ticket"), {
      commandId: "ticket.unarchive",
      when: 'workbench.resource.metadata.archived == "true"',
    });
    workbench.context.set("workbench.resource.type", "ticket");
    workbench.context.set("workbench.resource.metadata.archived", true);

    expect(createWorkbenchResourceActions(workbench, ticket)).toEqual([]);
    expect(
      createWorkbenchResourceActions(workbench, { ...ticket, metadata: { archived: true } }).map((a) => a.label),
    ).toEqual(["Unarchive"]);
  });
});
