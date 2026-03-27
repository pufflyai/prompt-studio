import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createHandler } from "./update";

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
      resolveTicketByShorthand: async () => makeTicket(),
      updateTicket,
      resolveStatusId: async () => "s-wip",
      resolveTagIds: async () => [],
      log,
    });

    await handler({ id: "PS-1", status: "wip", _: [], $0: "" } as never);

    expect(updateTicket).toHaveBeenCalledWith(expect.any(String), "t-1", { status_id: "s-wip" });
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
      log: () => {},
    });

    await expect(handler({ id: "PS-999", _: [], $0: "" } as never)).rejects.toThrow("Ticket not found: PS-999");
  });

  test("throws when status not found", async () => {
    const handler = createHandler({
      cwd: () => "/work/repo",
      resolveProjectId: () => ({ projectId: "proj-1", root: "/work/repo" }),
      resolveTicketByShorthand: async () => makeTicket(),
      updateTicket: async () => ({}) as never,
      resolveStatusId: async () => {
        throw new Error("Status not found: nonexistent");
      },
      resolveTagIds: async () => [],
      log: () => {},
    });

    await expect(handler({ id: "PS-1", status: "nonexistent", _: [], $0: "" } as never)).rejects.toThrow(
      "Status not found: nonexistent",
    );
  });

  test("updates local ticket file frontmatter when status changes", async () => {
    const ticketDir = join(tmpBase, ".pstdio", "tickets", "PS-1");
    mkdirSync(ticketDir, { recursive: true });
    writeFileSync(join(ticketDir, "ticket.md"), '---\nticket_id: "PS-1"\nstatus: "backlog"\n---\n\n# My Ticket');

    const handler = createHandler({
      cwd: () => tmpBase,
      resolveProjectId: () => ({ projectId: "proj-1", root: tmpBase }),
      resolveTicketByShorthand: async () => makeTicket(),
      updateTicket: async () => ({}) as never,
      resolveStatusId: async () => "s-review",
      resolveTagIds: async () => [],
      log: () => {},
    });

    await handler({ id: "PS-1", status: "review", _: [], $0: "" } as never);

    const content = readFileSync(join(ticketDir, "ticket.md"), "utf8");
    expect(content).toContain('status: "review"');
    expect(content).not.toContain('status: "backlog"');
    expect(content).toContain("# My Ticket");
  });

  test("skips local file update when no local ticket file exists", async () => {
    const log = mock();
    const handler = createHandler({
      cwd: () => tmpBase,
      resolveProjectId: () => ({ projectId: "proj-1", root: tmpBase }),
      resolveTicketByShorthand: async () => makeTicket(),
      updateTicket: async () => ({}) as never,
      resolveStatusId: async () => "s-review",
      resolveTagIds: async () => [],
      log,
    });

    await handler({ id: "PS-1", status: "review", _: [], $0: "" } as never);

    expect(log).toHaveBeenCalledWith("Updated ticket PS-1");
  });
});
