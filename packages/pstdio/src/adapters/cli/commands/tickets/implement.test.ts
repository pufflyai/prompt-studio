import { describe, expect, mock, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Status, TemplateWithContent } from "@pstdio/sdk/resources";
import { createHandler } from "./implement";

const makeTicket = (overrides: Record<string, unknown> = {}) => ({
  id: "t-1",
  shorthand: "PS-1",
  project_id: "proj-1",
  status_id: "s-1",
  display_title: "Implement me",
  file_id: null,
  draft: false,
  archived: false,
  status_name: "backlog",
  tag_names: [],
  created_at: "2026-03-04T00:00:00.000Z",
  ...overrides,
});

const makeTemplate = (overrides: Partial<TemplateWithContent> = {}): TemplateWithContent => ({
  id: "template-1",
  project_id: "proj-1",
  name: "implement-ticket",
  template_type: "prompt",
  file_id: "file-1",
  is_default: false,
  created_at: "2026-03-04T00:00:00.000Z",
  updated_at: "2026-03-04T00:00:00.000Z",
  deleted_at: null,
  content: "Implement ticket: {{ticket_id}}",
  ...overrides,
});

const makeStatus = (overrides: Partial<Status> = {}): Status => ({
  id: "s-wip",
  project_id: "proj-1",
  name: "wip",
  color: "orange",
  sort_order: 3,
  is_default: false,
  can_create: true,
  can_drag_in: true,
  can_drag_out: true,
  column_actions: [],
  created_at: "2026-03-04T00:00:00.000Z",
  updated_at: "2026-03-04T00:00:00.000Z",
  deleted_at: null,
  ...overrides,
});

describe("tickets implement", () => {
  test("moves ticket to wip and launches agent", async () => {
    const log = mock();
    const updateTicket = mock(async () => ({}) as never);
    const launchAgent = mock(async () => {});
    const getTemplate = mock(async () => makeTemplate());

    const handler = createHandler({
      cwd: () => "/work/repo",
      resolveProjectId: () => ({ projectId: "proj-1", root: "/work/repo" }),
      getTemplate,
      resolveTicketByShorthand: async () => makeTicket() as never,
      updateTicket,
      listTicketStatuses: async () => [makeStatus()],
      launchAgent,
      log,
    });

    await handler({ id: "PS-1", _: [], $0: "" } as never);

    expect(updateTicket).toHaveBeenCalledWith("t-1", { status_id: "s-wip" });
    expect(log).toHaveBeenCalledWith("Ticket PS-1 moved to wip");
    expect(log).toHaveBeenCalledWith("Launching agent...");
    expect(launchAgent).toHaveBeenCalledTimes(1);
    expect(getTemplate).toHaveBeenCalledWith("proj-1", "implement-ticket");
    expect(launchAgent).toHaveBeenCalledWith("PS-1", "/work/repo", "Implement me", "Implement ticket: PS-1");
  });

  test("throws when ticket not found", async () => {
    const handler = createHandler({
      cwd: () => "/work/repo",
      resolveProjectId: () => ({ projectId: "proj-1", root: "/work/repo" }),
      getTemplate: async () => null,
      resolveTicketByShorthand: async () => null as never,
      updateTicket: async () => ({}) as never,
      listTicketStatuses: async () => [],
      launchAgent: async () => {},
      log: () => {},
    });

    await expect(handler({ id: "PS-999", _: [], $0: "" } as never)).rejects.toThrow("Ticket not found: PS-999");
  });

  test("uses the local ticket file without fetching a template", async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-implement-"));
    const ticketDir = join(root, ".pstdio", "tickets", "PS-1");
    mkdirSync(ticketDir, { recursive: true });
    writeFileSync(join(ticketDir, "ticket.md"), "# Local ticket\n");

    const getTemplate = mock(async () => makeTemplate());
    const launchAgent = mock(async () => {});

    const handler = createHandler({
      cwd: () => root,
      resolveProjectId: () => ({ projectId: "proj-1", root }),
      getTemplate,
      resolveTicketByShorthand: async () => makeTicket() as never,
      updateTicket: async () => ({}) as never,
      listTicketStatuses: async () => [],
      launchAgent,
      log: () => {},
    });

    await handler({ id: "PS-1", _: [], $0: "" } as never);

    expect(getTemplate).not.toHaveBeenCalled();
    expect(launchAgent).toHaveBeenCalledWith("PS-1", root, "Implement me", "# Local ticket\n");
  });

  test("throws when the implement prompt template is missing", async () => {
    const handler = createHandler({
      cwd: () => "/work/repo",
      resolveProjectId: () => ({ projectId: "proj-1", root: "/work/repo" }),
      getTemplate: async () => null,
      resolveTicketByShorthand: async () => makeTicket() as never,
      updateTicket: async () => ({}) as never,
      listTicketStatuses: async () => [],
      launchAgent: async () => {},
      log: () => {},
    });

    await expect(handler({ id: "PS-1", _: [], $0: "" } as never)).rejects.toThrow(
      "Template not found: implement-ticket",
    );
  });
});
