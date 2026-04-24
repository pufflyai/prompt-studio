import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import yargs from "yargs";
import { builder, createHandler } from "./update";

const tmpBase = join(import.meta.dirname, "__test-tmp-update__");

const makeTicket = (overrides: Record<string, unknown> = {}) => ({
  id: "t-1",
  shorthand: "PS-1",
  project_id: "proj-1",
  status_id: "s-1",
  display_title: "Ticket",
  file_id: null,
  draft: false,
  archived: false,
  status_name: "backlog",
  tag_names: [],
  created_at: "2026-03-04T00:00:00.000Z",
  ...overrides,
});

beforeEach(() => {
  mkdirSync(tmpBase, { recursive: true });
});

afterEach(() => {
  rmSync(tmpBase, { recursive: true, force: true });
});

describe("tickets update", () => {
  test("updates ticket status", async () => {
    const log = mock();
    const updateTicket = mock(async () => ({}) as never);

    const handler = createHandler({
      cwd: () => "/work/repo",
      resolveProjectId: () => ({ projectId: "proj-1", root: "/work/repo" }),
      resolveTicketByShorthand: async () => makeTicket() as never,
      updateTicket,
      resolveStatusId: async () => "s-wip",
      resolveTagIds: async () => [],
      resolveParentTicketId: async (_projectId: string, value: string) => value,
      log,
    });

    await handler({ id: "PS-1", status: "wip", _: [], $0: "" } as never);

    expect(updateTicket).toHaveBeenCalledWith("t-1", { status_id: "s-wip" });
    expect(log).toHaveBeenCalledWith("Updated ticket PS-1");
  });

  test("throws when ticket not found", async () => {
    const handler = createHandler({
      cwd: () => "/work/repo",
      resolveProjectId: () => ({ projectId: "proj-1", root: "/work/repo" }),
      resolveTicketByShorthand: async () => null as never,
      updateTicket: async () => ({}) as never,
      resolveStatusId: async () => "",
      resolveTagIds: async () => [],
      resolveParentTicketId: async (_projectId: string, value: string) => value,
      log: () => {},
    });

    await expect(handler({ id: "PS-999", _: [], $0: "" } as never)).rejects.toThrow("Ticket not found: PS-999");
  });

  test("throws when status not found", async () => {
    const handler = createHandler({
      cwd: () => "/work/repo",
      resolveProjectId: () => ({ projectId: "proj-1", root: "/work/repo" }),
      resolveTicketByShorthand: async () => makeTicket() as never,
      updateTicket: async () => ({}) as never,
      resolveStatusId: async () => {
        throw new Error("Status not found: nonexistent");
      },
      resolveTagIds: async () => [],
      resolveParentTicketId: async (_projectId: string, value: string) => value,
      log: () => {},
    });

    await expect(handler({ id: "PS-1", status: "nonexistent", _: [], $0: "" } as never)).rejects.toThrow(
      "Status not found: nonexistent",
    );
  });

  test("does not rewrite local ticket file when status changes", async () => {
    const ticketDir = join(tmpBase, ".pstdio", "tickets", "PS-1");
    mkdirSync(ticketDir, { recursive: true });
    writeFileSync(join(ticketDir, "ticket.md"), '---\nticket_id: "PS-1"\nstatus: "backlog"\n---\n\n# My Ticket');

    const handler = createHandler({
      cwd: () => tmpBase,
      resolveProjectId: () => ({ projectId: "proj-1", root: tmpBase }),
      resolveTicketByShorthand: async () => makeTicket() as never,
      updateTicket: async () => ({}) as never,
      resolveStatusId: async () => "s-review",
      resolveTagIds: async () => [],
      resolveParentTicketId: async (_projectId: string, value: string) => value,
      log: () => {},
    });

    await handler({ id: "PS-1", status: "review", _: [], $0: "" } as never);

    const content = readFileSync(join(ticketDir, "ticket.md"), "utf8");
    expect(content).toContain('status: "backlog"');
    expect(content).toContain("# My Ticket");
  });

  test("does not create a local ticket file when one does not exist", async () => {
    const log = mock();
    const handler = createHandler({
      cwd: () => tmpBase,
      resolveProjectId: () => ({ projectId: "proj-1", root: tmpBase }),
      resolveTicketByShorthand: async () => makeTicket() as never,
      updateTicket: async () => ({}) as never,
      resolveStatusId: async () => "s-review",
      resolveTagIds: async () => [],
      resolveParentTicketId: async (_projectId: string, value: string) => value,
      log,
    });

    await handler({ id: "PS-1", status: "review", _: [], $0: "" } as never);

    expect(existsSync(join(tmpBase, ".pstdio", "tickets", "PS-1", "ticket.md"))).toBe(false);
    expect(log).toHaveBeenCalledWith("Updated ticket PS-1");
  });

  test("passes parent_id when --parent-id is a shorthand", async () => {
    const updateTicket = mock(async () => ({}) as never);
    const handler = createHandler({
      cwd: () => "/work/repo",
      resolveProjectId: () => ({ projectId: "proj-1", root: "/work/repo" }),
      resolveTicketByShorthand: async () => makeTicket() as never,
      updateTicket,
      resolveStatusId: async () => "s-review",
      resolveTagIds: async () => [],
      resolveParentTicketId: async () => "ticket-uuid-1",
      log: mock(),
    });

    await handler({ id: "PS-1", "parent-id": "PS-2", _: [], $0: "" } as never);

    expect(updateTicket).toHaveBeenCalledWith("t-1", { parent_id: "ticket-uuid-1" });
  });

  test("passes parent_id when --parent-id is a UUID", async () => {
    const updateTicket = mock(async () => ({}) as never);
    const parentId = "11111111-1111-4111-8111-111111111111";
    const handler = createHandler({
      cwd: () => "/work/repo",
      resolveProjectId: () => ({ projectId: "proj-1", root: "/work/repo" }),
      resolveTicketByShorthand: async () => makeTicket() as never,
      updateTicket,
      resolveStatusId: async () => "s-review",
      resolveTagIds: async () => [],
      resolveParentTicketId: async () => parentId,
      log: mock(),
    });

    await handler({ id: "PS-1", "parent-id": parentId, _: [], $0: "" } as never);

    expect(updateTicket).toHaveBeenCalledWith("t-1", { parent_id: parentId });
  });

  test("clears parent_id when --no-parent-id is set", async () => {
    const updateTicket = mock(async () => ({}) as never);
    const handler = createHandler({
      cwd: () => "/work/repo",
      resolveProjectId: () => ({ projectId: "proj-1", root: "/work/repo" }),
      resolveTicketByShorthand: async () => makeTicket() as never,
      updateTicket,
      resolveStatusId: async () => "s-review",
      resolveTagIds: async () => [],
      resolveParentTicketId: async (_projectId: string, value: string) => value,
      log: mock(),
    });

    await handler({ id: "PS-1", "no-parent-id": true, _: [], $0: "" } as never);

    expect(updateTicket).toHaveBeenCalledWith("t-1", { parent_id: null });
  });

  test("throws when both --parent-id and --no-parent-id are provided", async () => {
    const handler = createHandler({
      cwd: () => "/work/repo",
      resolveProjectId: () => ({ projectId: "proj-1", root: "/work/repo" }),
      resolveTicketByShorthand: async () => makeTicket() as never,
      updateTicket: async () => ({}) as never,
      resolveStatusId: async () => "s-review",
      resolveTagIds: async () => [],
      resolveParentTicketId: async (_projectId: string, value: string) => value,
      log: mock(),
    });

    await expect(
      handler({ id: "PS-1", "parent-id": "PS-2", "no-parent-id": true, _: [], $0: "" } as never),
    ).rejects.toThrow("Cannot combine --parent-id with --no-parent-id");
  });

  test("throws when parent ticket is not found", async () => {
    const handler = createHandler({
      cwd: () => "/work/repo",
      resolveProjectId: () => ({ projectId: "proj-1", root: "/work/repo" }),
      resolveTicketByShorthand: async () => makeTicket() as never,
      updateTicket: async () => ({}) as never,
      resolveStatusId: async () => "s-review",
      resolveTagIds: async () => [],
      resolveParentTicketId: async () => {
        throw new Error("Parent ticket not found: PS-999");
      },
      log: mock(),
    });

    await expect(handler({ id: "PS-1", "parent-id": "PS-999", _: [], $0: "" } as never)).rejects.toThrow(
      "Parent ticket not found: PS-999",
    );
  });

  test("clears parent_id when parsed from --no-parent-id", async () => {
    const updateTicket = mock(async () => ({}) as never);
    const handler = createHandler({
      cwd: () => "/work/repo",
      resolveProjectId: () => ({ projectId: "proj-1", root: "/work/repo" }),
      resolveTicketByShorthand: async () => makeTicket() as never,
      updateTicket,
      resolveStatusId: async () => "s-review",
      resolveTagIds: async () => [],
      resolveParentTicketId: async (_projectId: string, value: string) => value,
      log: mock(),
    });

    const cli = builder(
      yargs([])
        .exitProcess(false)
        .fail((message, error) => {
          throw error ?? new Error(message);
        }),
    );
    const argv = cli.parseSync(["--id", "PS-1", "--no-parent-id"]);

    await handler(argv as never);

    expect(updateTicket).toHaveBeenCalledWith("t-1", { parent_id: null });
  });

  test("throws when parsed from --parent-id and --no-parent-id", async () => {
    const handler = createHandler({
      cwd: () => "/work/repo",
      resolveProjectId: () => ({ projectId: "proj-1", root: "/work/repo" }),
      resolveTicketByShorthand: async () => makeTicket() as never,
      updateTicket: async () => ({}) as never,
      resolveStatusId: async () => "s-review",
      resolveTagIds: async () => [],
      resolveParentTicketId: async (_projectId: string, value: string) => value,
      log: mock(),
    });

    const cli = builder(
      yargs([])
        .exitProcess(false)
        .fail((message, error) => {
          throw error ?? new Error(message);
        }),
    );
    const argv = cli.parseSync(["--id", "PS-1", "--parent-id", "PS-2", "--no-parent-id"]);

    await expect(handler(argv as never)).rejects.toThrow("Cannot combine --parent-id with --no-parent-id");
  });
});
