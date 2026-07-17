import { describe, expect, test } from "bun:test";
import { createDashboardResource } from "@/shared/app/resources";
import { createTicketResourceProvider } from "./ticket-resource-provider";

const workspace = (metadata: Record<string, unknown>) =>
  createDashboardResource("workspace", "workspace-1", "T-2_A1", "GitBranch", "project-1", metadata);

describe("createTicketResourceProvider", () => {
  test("projects the single-ticket fallback and connects the workspace to it", () => {
    const source = workspace({ ticketId: "ticket/one", ticketLabel: "T-1 Ticket", ticketShorthand: "T-1" });
    const tickets = createTicketResourceProvider({ getProjectId: () => "project-1", getWorkspaces: () => [source] });
    const connected = tickets.connectWorkspace(source);
    const ticket = tickets.provider.get?.("dashboard-workbench://ticket/ticket%2Fone", {});

    expect(connected.parent).toBe("dashboard-workbench://ticket/ticket%2Fone");
    expect(ticket).toMatchObject({
      kind: "ticket",
      id: "ticket/one",
      label: "T-1 Ticket",
      parent: "dashboard-workbench://dashboard-view/tickets",
      metadata: { projectId: "project-1", ticketId: "ticket/one", ticketShorthand: "T-1" },
    });
  });

  test("materializes multi-level ancestry as parent edges", () => {
    const source = workspace({
      ticketId: "ticket-child",
      ticketLabel: "T-2 Child",
      ticketShorthand: "T-2",
      ticketBreadcrumb: [
        { id: "ticket-parent", label: "T-1 Parent", shorthand: "T-1" },
        { id: "ticket-child", label: "T-2 Child", shorthand: "T-2" },
      ],
    });
    const tickets = createTicketResourceProvider({ getProjectId: () => "project-1", getWorkspaces: () => [source] });

    expect(tickets.provider.get?.("dashboard-workbench://ticket/ticket-child", {})?.parent).toBe(
      "dashboard-workbench://ticket/ticket-parent",
    );
    expect(tickets.provider.get?.("dashboard-workbench://ticket/ticket-parent", {})?.parent).toBe(
      "dashboard-workbench://dashboard-view/tickets",
    );
  });

  test("lists projected tickets and resolves the tickets board", () => {
    const source = workspace({ ticketId: "ticket-1", ticketLabel: "T-1 Ticket" });
    const tickets = createTicketResourceProvider({ getProjectId: () => "project-1", getWorkspaces: () => [source] });

    expect(tickets.provider.list("T-1", {}).map((entry) => entry.resource.id)).toEqual(["ticket-1"]);
    expect(tickets.provider.get?.("dashboard-workbench://dashboard-view/tickets", {})?.label).toBe("Tickets");
  });

  test("connects a workspace supplied outside the synced workspace source", () => {
    const source = workspace({ ticketId: "ticket-badge", ticketLabel: "T-3 Badge" });
    const tickets = createTicketResourceProvider({ getProjectId: () => "project-1", getWorkspaces: () => [] });

    tickets.connectWorkspace(source);

    expect(tickets.provider.get?.("dashboard-workbench://ticket/ticket-badge", {})?.label).toBe("T-3 Badge");
  });
});
