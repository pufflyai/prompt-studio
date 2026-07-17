import { describe, expect, test } from "bun:test";
import { createDashboardResource } from "@/shared/app/resources";
import { createTicketResourceProvider } from "./ticket-resource-provider";

const workspace = (metadata: Record<string, unknown>) =>
  createDashboardResource("workspace", "workspace-1", "T-2_A1", "GitBranch", "project-1", metadata);

const ticketRow = (id: string, shorthand: string, title: string, parentId: string | null = null) => ({
  id,
  project_id: "project-1",
  shorthand,
  title,
  parent_id: parentId,
});

describe("createTicketResourceProvider", () => {
  test("projects the single-ticket fallback and connects the workspace to it", () => {
    const source = workspace({ ticketId: "ticket/one", ticketLabel: "T-1 Ticket", ticketShorthand: "T-1" });
    const tickets = createTicketResourceProvider({
      getProjectId: () => "project-1",
      getTickets: () => [ticketRow("ticket/one", "T-1", "Ticket")],
      getWorkspaces: () => [source],
    });
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

  test("materializes deep synced ancestry as parent edges", () => {
    const source = workspace({
      ticketId: "ticket-leaf",
      ticketLabel: "T-4 Leaf",
      ticketShorthand: "T-4",
    });
    const tickets = createTicketResourceProvider({
      getProjectId: () => "project-1",
      getTickets: () => [
        ticketRow("ticket-root", "T-1", "Root"),
        ticketRow("ticket-parent", "T-2", "Parent", "ticket-root"),
        ticketRow("ticket-child", "T-3", "Child", "ticket-parent"),
        ticketRow("ticket-leaf", "T-4", "Leaf", "ticket-child"),
      ],
      getWorkspaces: () => [source],
    });

    expect(tickets.provider.get?.("dashboard-workbench://ticket/ticket-leaf", {})?.parent).toBe(
      "dashboard-workbench://ticket/ticket-child",
    );
    expect(tickets.provider.get?.("dashboard-workbench://ticket/ticket-child", {})?.parent).toBe(
      "dashboard-workbench://ticket/ticket-parent",
    );
    expect(tickets.provider.get?.("dashboard-workbench://ticket/ticket-parent", {})?.parent).toBe(
      "dashboard-workbench://ticket/ticket-root",
    );
    expect(tickets.provider.get?.("dashboard-workbench://ticket/ticket-root", {})?.parent).toBe(
      "dashboard-workbench://dashboard-view/tickets",
    );
  });

  test("lists projected tickets and resolves the tickets board", () => {
    const source = workspace({ ticketId: "ticket-1", ticketLabel: "T-1 Ticket" });
    const tickets = createTicketResourceProvider({
      getProjectId: () => "project-1",
      getTickets: () => [ticketRow("ticket-1", "T-1", "Ticket")],
      getWorkspaces: () => [source],
    });

    expect(tickets.provider.list("T-1", {}).map((entry) => entry.resource.id)).toEqual(["ticket-1"]);
    expect(tickets.provider.get?.("dashboard-workbench://dashboard-view/tickets", {})?.label).toBe("Tickets");
  });

  test("connects a workspace supplied outside the synced workspace source", () => {
    const source = workspace({ ticketId: "ticket-badge", ticketLabel: "T-3 Badge" });
    const tickets = createTicketResourceProvider({
      getProjectId: () => "project-1",
      getTickets: () => [ticketRow("ticket-badge", "T-3", "Badge")],
      getWorkspaces: () => [],
    });

    tickets.connectWorkspace(source);

    expect(tickets.provider.get?.("dashboard-workbench://ticket/ticket-badge", {})?.label).toBe("T-3 Badge");
  });
});
