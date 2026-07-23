import { describe, expect, test } from "bun:test";
import { createWorkbenchCore, type ResourceRef, resourceContextMenuPath } from "../../core";
import { createWorkbenchResourceActions } from "./resource-actions";

const ticket: ResourceRef = {
  kind: "ticket",
  uri: "pstdio://tickets/PS-179",
  id: "PS-179",
  label: "PS-179 Resource actions",
};

const workspace: ResourceRef = {
  kind: "workspace",
  uri: "pstdio://workspaces/PS-179_A1",
  id: "PS-179_A1",
  label: "PS-179_A1",
};

describe("createWorkbenchResourceActions", () => {
  test("uses the selected resource context for visibility and execution", async () => {
    const workbench = createWorkbenchCore();
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
      when: 'workbench.resource.kind == "ticket"',
    });

    const ticketActions = createWorkbenchResourceActions(workbench, ticket);
    const workspaceActions = createWorkbenchResourceActions(workbench, workspace);

    expect(ticketActions.map((action) => action.label)).toEqual(["Run attempt"]);
    expect(ticketActions.map((action) => action.commandId)).toEqual(["pstdio-planner.run-attempt"]);
    expect(workspaceActions).toEqual([]);

    await ticketActions[0]?.onClick();
    expect(openedResource).toEqual(ticket);
  });
});
