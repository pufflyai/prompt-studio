import { describe, expect, test } from "bun:test";
import type { ExtensionCommandRecord, ExtensionMenuContribution } from "@pstdio/sdk/api";
import { buildExtensionActionDescriptor, mapExtensionActionParams } from "./extension-action-params";
import type { ExtensionResourceContext } from "./types";

const contribution: ExtensionMenuContribution = {
  id: "pstdio-core-ticket-automations.runAttempt.ticket.headerPrimary",
  extensionId: "pstdio-core-ticket-automations",
  commandId: "pstdio-core-ticket-automations.runAttempt",
  slotId: "ticket.headerPrimary",
  label: "Run attempt",
  icon: "play",
  presentation: "button",
};

const command = (params: NonNullable<ExtensionCommandRecord["params"]>): ExtensionCommandRecord => ({
  id: "pstdio-core-ticket-automations.runAttempt",
  extensionId: "pstdio-core-ticket-automations",
  title: "Run attempt",
  params,
});

describe("extension action params", () => {
  test("uses the current ticket resource as the ticket param and keeps chooser params in the dialog", () => {
    const ticketResource: ExtensionResourceContext = {
      type: "ticket",
      id: "ticket-row-1",
      label: "PS-304",
      metadata: { shorthand: "PS-304" },
    };

    const action = buildExtensionActionDescriptor({
      contribution,
      command: command({
        ticket: { type: "text", label: "Ticket" },
        harness: { type: "harness", label: "Harness", required: false },
        repo: { type: "repo", label: "Repository", required: false },
      }),
      resource: ticketResource,
    });

    expect(action.baseParams).toEqual({ ticket: "PS-304" });
    expect(action.icon).toBe("play");
    expect(action.presentation).toBe("button");
    expect(action.params).toEqual([
      { key: "harness", label: "Harness", type: "agent", required: false },
      { key: "repo", label: "Repository", type: "repo", required: false },
    ]);
  });

  test("maps refine ticket params to action dialog fields", () => {
    const action = buildExtensionActionDescriptor({
      contribution: {
        ...contribution,
        commandId: "pstdio-core-ticket-automations.refineTicket",
        label: "Refine ticket",
      },
      command: command({
        ticket: { type: "text", label: "Ticket" },
        harness: { type: "harness", label: "Harness", required: false },
        template: { type: "template", label: "Template", templateType: "ticket", required: false },
        context: { type: "longtext", label: "Context", required: false },
      }),
      resource: { type: "ticket", id: "ticket-row-1", label: "PS-304" },
    });

    expect(action.baseParams).toEqual({ ticket: "PS-304" });
    expect(action.params).toEqual([
      { key: "harness", label: "Harness", type: "agent", required: false },
      { key: "template", label: "Template", type: "template-select", required: false, templateType: "ticket" },
      { key: "context", label: "Context", type: "longtext", required: false },
    ]);
  });

  test("uses the current ticket resource as the legacy row id param", () => {
    const action = buildExtensionActionDescriptor({
      contribution: {
        ...contribution,
        commandId: "pstdio-planner.breakIntoSubTickets",
        label: "Break into sub-tickets",
      },
      command: command({
        rowId: { type: "text", label: "Ticket row" },
        ticket: { type: "text", label: "Ticket" },
        template: { type: "template", label: "Template", templateType: "ticket", required: false },
      }),
      resource: { type: "ticket", id: "ticket-row-1", label: "PS-304", metadata: { shorthand: "PS-304" } },
    });

    expect(action.baseParams).toEqual({ rowId: "ticket-row-1", ticket: "PS-304" });
    expect(action.params).toEqual([
      { key: "template", label: "Template", type: "template-select", required: false, templateType: "ticket" },
    ]);
  });

  test("uses the current workspace resource as workspace and ticket params", () => {
    const action = buildExtensionActionDescriptor({
      contribution: {
        ...contribution,
        commandId: "pstdio-planner.runReview",
        slotId: "workspace.headerPrimary",
        label: "Run review",
      },
      command: {
        id: "pstdio-planner.runReview",
        extensionId: "pstdio-planner",
        title: "Run review",
        params: {
          workspaceId: { type: "text", label: "Workspace" },
          ticket: { type: "text", label: "Ticket", required: false },
          harness: { type: "harness", label: "Harness", required: false },
        },
      },
      resource: {
        type: "workspace",
        id: "workspace-1",
        label: "A1",
        metadata: { ticket: "PS-304", workspaceShorthand: "PS-304_A1" },
      },
    });

    expect(action.baseParams).toEqual({ workspaceId: "workspace-1", ticket: "PS-304" });
    expect(action.params).toEqual([{ key: "harness", label: "Harness", type: "agent", required: false }]);
  });

  test("keeps row id dialog params for non-ticket resources", () => {
    const action = buildExtensionActionDescriptor({
      contribution: {
        ...contribution,
        commandId: "lab.workspaceAction",
        slotId: "workspace.headerOverflow",
        label: "Workspace action",
      },
      command: command({
        workspaceId: { type: "text", label: "Workspace" },
        rowId: { type: "text", label: "Row" },
      }),
      resource: {
        type: "workspace",
        id: "workspace-1",
        label: "A1",
      },
    });

    expect(action.baseParams).toEqual({ workspaceId: "workspace-1" });
    expect(action.params).toEqual([{ key: "rowId", label: "Row", type: "text" }]);
  });

  test("maps dialog composite values back to extension param values", () => {
    expect(
      mapExtensionActionParams({
        harness: { agent: "codex", model: "gpt-5" },
        repo: { repo: "repo-1", branch: "main" },
        context: "Use current acceptance criteria",
      }),
    ).toEqual({
      harness: { harnessId: "codex", model: "gpt-5" },
      repo: { repoId: "repo-1", branch: "main" },
      context: "Use current acceptance criteria",
    });
  });
});
