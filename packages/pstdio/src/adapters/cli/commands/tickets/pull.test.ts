import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createHandler } from "./pull";

const tmpBase = join(import.meta.dirname, "__test-tmp-pull__");

const makeListItem = (
  overrides: Partial<{ id: string; shorthand: string; display_title: string; status_name: string | null }> = {},
) => ({
  id: overrides.id ?? "ticket-1",
  shorthand: overrides.shorthand ?? "PS-1",
  project_id: "proj-1",
  status_id: null,
  display_title: overrides.display_title ?? "Pulled ticket",
  file_id: "file-content-1" as string | null,
  priority: null,
  complexity: null,
  draft: false,
  archived: false,
  status_name: overrides.status_name ?? null,
  tag_names: [] as string[],
  created_at: "2026-03-04T00:00:00.000Z",
});

type TicketOverrides = Partial<{
  id: string;
  shorthand: string;
  display_title: string;
  file_id: string | null;
  priority: string | null;
  complexity: string | null;
  parent_id: string | null;
}>;

const makeTicket = (overrides: TicketOverrides = {}) => ({
  id: overrides.id ?? "ticket-1",
  shorthand: overrides.shorthand ?? "PS-1",
  project_id: "proj-1",
  status_id: null,
  display_title: overrides.display_title ?? "Pulled ticket",
  user_prompt: null,
  file_id: overrides.file_id ?? "file-content-1",
  priority: overrides.priority ?? null,
  complexity: overrides.complexity ?? null,
  parent_id: overrides.parent_id ?? null,
  parallelizable: null,
  blocked_reason: null,
  depends_on: null,
  draft: false,
  archived: false,
  deleted_at: null,
  created_at: "2026-03-04T00:00:00.000Z",
  updated_at: "2026-03-04T00:00:00.000Z",
});

const makeFile = (overrides: Partial<{ id: string; file_name: string; size_bytes: number }> = {}) => ({
  id: overrides.id ?? "file-1",
  project_id: "proj-1",
  file_name: overrides.file_name ?? "notes.txt",
  file_kind: "ticket_file",
  storage_path: "/tmp/ignored",
  mime_type: "text/plain",
  size_bytes: overrides.size_bytes ?? 13,
  hash: null,
  created_at: "2026-03-04T00:00:00.000Z",
  updated_at: "2026-03-04T00:00:00.000Z",
});

const baseDeps = () => ({
  cwd: () => tmpBase,
  resolveProjectId: () => ({ projectId: "proj-1", root: tmpBase }),
  listTickets: async () => [],
});

beforeEach(() => {
  mkdirSync(tmpBase, { recursive: true });
  mkdirSync(join(tmpBase, ".git"), { recursive: true });
});

afterEach(() => {
  rmSync(tmpBase, { recursive: true, force: true });
});

describe("tickets pull", () => {
  test("pulls ticket content from file and attachment files into local ticket directory", async () => {
    const log = mock();
    const getTicketFileContent = mock(async (_url: string, _ticketId: string, fileId: string) =>
      fileId === "file-content-1" ? Buffer.from("# Ticket from DB", "utf8") : Buffer.from("hello from db", "utf8"),
    );

    const handler = createHandler({
      ...baseDeps(),
      resolveTicketByShorthand: async () => makeListItem(),
      getTicket: async () => makeTicket(),
      listTicketFiles: async () => [makeFile()],
      getTicketFileContent,
      log,
    });

    await handler({ id: "PS-1", force: false, _: [], $0: "" } as never);

    const ticketPath = join(tmpBase, ".pstdio", "tickets", "PS-1_ticket-from-db", "ticket.md");
    const localFilePath = join(tmpBase, ".pstdio", "tickets", "PS-1_ticket-from-db", "files", "notes.txt");
    expect(existsSync(ticketPath)).toBe(true);
    expect(existsSync(localFilePath)).toBe(true);
    const ticketContent = readFileSync(ticketPath, "utf8");
    expect(ticketContent).toContain("ticket_id:");
    expect(ticketContent).toContain('created: "2026-03-04T00:00:00.000Z"');
    expect(ticketContent).toContain("# Ticket from DB");
    expect(readFileSync(localFilePath, "utf8")).toBe("hello from db");
    expect(log).toHaveBeenCalledWith(expect.stringContaining("Pulled ticket PS-1"));
    expect(log).toHaveBeenCalledWith("Downloaded 1 ticket files");
  });

  test("populates frontmatter with ticket metadata from DB", async () => {
    const handler = createHandler({
      ...baseDeps(),
      resolveTicketByShorthand: async () => makeListItem({ status_name: "wip" }),
      getTicket: async () => makeTicket({ priority: "P1", complexity: "medium", parent_id: "PS-0" }),
      listTicketFiles: async () => [],
      getTicketFileContent: async () => Buffer.from("# Ticket from DB"),
      log: () => {},
    });

    await handler({ id: "PS-1", force: false, _: [], $0: "" } as never);

    const ticketPath = join(tmpBase, ".pstdio", "tickets", "PS-1_ticket-from-db", "ticket.md");
    const content = readFileSync(ticketPath, "utf8");
    expect(content).toStartWith("---\n");
    expect(content).toContain("ticket_id:");
    expect(content).toContain('status: "wip"');
    expect(content).toContain('priority: "P1"');
    expect(content).toContain('complexity: "medium"');
    expect(content).toContain('parent_id: "PS-0"');
    expect(content).toContain("# Ticket from DB");
  });

  test("writes parent_id frontmatter using parent ticket shorthand when DB stores parent UUID", async () => {
    const handler = createHandler({
      ...baseDeps(),
      resolveTicketByShorthand: async () => makeListItem({ id: "child-ticket-id", shorthand: "PS-2" }),
      getTicket: async (_url: string, id: string) => {
        if (id === "child-ticket-id") {
          return makeTicket({
            id: "child-ticket-id",
            shorthand: "PS-2",
            parent_id: "parent-ticket-id",
          });
        }

        if (id === "parent-ticket-id") {
          return makeTicket({
            id: "parent-ticket-id",
            shorthand: "PS-1",
            parent_id: null,
          });
        }

        return null as never;
      },
      listTicketFiles: async () => [],
      getTicketFileContent: async () => Buffer.from("# Ticket from DB"),
      log: () => {},
    });

    await handler({ id: "PS-2", force: false, _: [], $0: "" } as never);

    const ticketPath = join(tmpBase, ".pstdio", "tickets", "PS-2_ticket-from-db", "ticket.md");
    const content = readFileSync(ticketPath, "utf8");
    expect(content).toContain('parent_id: "PS-1"');
    expect(content).not.toContain('parent_id: "parent-ticket-id"');
  });

  test("throws when local file exists and --force is not set", async () => {
    const ticketDir = join(tmpBase, ".pstdio", "tickets", "PS-1_pulled-ticket");
    mkdirSync(join(ticketDir, "files"), { recursive: true });
    writeFileSync(join(ticketDir, "ticket.md"), "# Pulled ticket");
    writeFileSync(join(ticketDir, "files", "notes.txt"), "existing");

    const handler = createHandler({
      ...baseDeps(),
      resolveTicketByShorthand: async () => makeListItem(),
      getTicket: async () => makeTicket(),
      listTicketFiles: async () => [makeFile({ size_bytes: 8 })],
      getTicketFileContent: async () => Buffer.from("# Pulled ticket\nnew content"),
      log: () => {},
    });

    await expect(handler({ id: "PS-1", force: false, _: [], $0: "" } as never)).rejects.toThrow(
      "Local file already exists:",
    );
  });

  test("pulls all non-archived tickets when --id is omitted", async () => {
    const log = mock();

    const handler = createHandler({
      ...baseDeps(),
      resolveTicketByShorthand: async () => null as never,
      getTicket: async (_baseUrl: string, id: string) =>
        id === "ticket-1"
          ? makeTicket({ id: "ticket-1", shorthand: "PS-1", display_title: "First ticket", file_id: "fc-1" })
          : makeTicket({ id: "ticket-2", shorthand: "PS-2", display_title: "Second ticket", file_id: "fc-2" }),
      listTicketFiles: async () => [],
      getTicketFileContent: async (_url: string, _ticketId: string, fileId: string) =>
        fileId === "fc-1" ? Buffer.from("# First ticket") : Buffer.from("# Second ticket"),
      listTickets: async () => [
        makeListItem({ id: "ticket-1", shorthand: "PS-1", display_title: "First ticket" }),
        makeListItem({ id: "ticket-2", shorthand: "PS-2", display_title: "Second ticket" }),
      ],
      log,
    });

    await handler({ force: false, _: [], $0: "" } as never);

    const ticket1Path = join(tmpBase, ".pstdio", "tickets", "PS-1_first-ticket", "ticket.md");
    const ticket2Path = join(tmpBase, ".pstdio", "tickets", "PS-2_second-ticket", "ticket.md");
    expect(existsSync(ticket1Path)).toBe(true);
    expect(existsSync(ticket2Path)).toBe(true);
    expect(readFileSync(ticket1Path, "utf8")).toContain("# First ticket");
    expect(readFileSync(ticket2Path, "utf8")).toContain("# Second ticket");
    expect(log).toHaveBeenCalledWith("Pulled 2 tickets");
  });

  test("logs message when no non-archived tickets exist", async () => {
    const log = mock();

    const handler = createHandler({
      ...baseDeps(),
      resolveTicketByShorthand: async () => null as never,
      getTicket: async () => null as never,
      listTicketFiles: async () => [],
      getTicketFileContent: async () => Buffer.alloc(0),
      listTickets: async () => [],
      log,
    });

    await handler({ force: false, _: [], $0: "" } as never);

    expect(log).toHaveBeenCalledWith("No tickets to pull.");
  });
});
