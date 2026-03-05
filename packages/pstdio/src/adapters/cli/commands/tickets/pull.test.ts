import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createHandler } from "./pull";

const tmpBase = join(import.meta.dirname, "__test-tmp-pull__");

beforeEach(() => {
  mkdirSync(tmpBase, { recursive: true });
  mkdirSync(join(tmpBase, ".git"), { recursive: true });
});

afterEach(() => {
  rmSync(tmpBase, { recursive: true, force: true });
});

describe("tickets pull", () => {
  test("pulls ticket content and files into local ticket directory", async () => {
    const log = mock();
    const getTicketFileContent = mock(async () => Buffer.from("hello from db", "utf8"));

    const handler = createHandler({
      cwd: () => tmpBase,
      findGitRoot: () => tmpBase,
      readConfig: () => ({ project_id: "proj-1" }),
      listTickets: async () => [
        {
          id: "ticket-1",
          shorthand: "PS-1",
          project_id: "proj-1",
          status_id: null,
          title: "Pulled ticket",
          priority: null,
          complexity: null,
          draft: false,
          archived: false,
          status_name: null,
          tag_names: [],
          created_at: "2026-03-04T00:00:00.000Z",
        },
      ],
      getTicket: async () => ({
        id: "ticket-1",
        shorthand: "PS-1",
        project_id: "proj-1",
        status_id: null,
        title: "Pulled ticket",
        input: "# Ticket from DB",
        priority: null,
        complexity: null,
        parent_id: null,
        parallelizable: null,
        blocked_reason: null,
        depends_on: null,
        draft: false,
        archived: false,
        deleted_at: null,
        created_at: "2026-03-04T00:00:00.000Z",
        updated_at: "2026-03-04T00:00:00.000Z",
      }),
      listTicketFiles: async () => [
        {
          id: "file-1",
          project_id: "proj-1",
          file_name: "notes.txt",
          file_kind: "ticket_file",
          storage_path: "/tmp/ignored",
          mime_type: "text/plain",
          size_bytes: 13,
          hash: null,
          created_at: "2026-03-04T00:00:00.000Z",
          updated_at: "2026-03-04T00:00:00.000Z",
        },
      ],
      getTicketFileContent,
      log,
    });

    await handler({ id: "PS-1", force: false, _: [], $0: "" } as never);

    const ticketPath = join(tmpBase, ".pstdio", "tickets", "PS-1_ticket-from-db", "ticket.md");
    const localFilePath = join(tmpBase, ".pstdio", "tickets", "PS-1_ticket-from-db", "files", "notes.txt");
    expect(existsSync(ticketPath)).toBe(true);
    expect(existsSync(localFilePath)).toBe(true);
    expect(readFileSync(ticketPath, "utf8")).toBe("# Ticket from DB");
    expect(readFileSync(localFilePath, "utf8")).toBe("hello from db");
    expect(getTicketFileContent).toHaveBeenCalledWith(expect.any(String), "ticket-1", "file-1");
    expect(log).toHaveBeenCalledWith(expect.stringContaining("Pulled ticket PS-1"));
    expect(log).toHaveBeenCalledWith("Downloaded 1 ticket files");
  });

  test("throws when local file exists and --force is not set", async () => {
    const ticketDir = join(tmpBase, ".pstdio", "tickets", "PS-1_pulled-ticket");
    mkdirSync(join(ticketDir, "files"), { recursive: true });
    writeFileSync(join(ticketDir, "ticket.md"), "# Pulled ticket");
    writeFileSync(join(ticketDir, "files", "notes.txt"), "existing");

    const handler = createHandler({
      cwd: () => tmpBase,
      findGitRoot: () => tmpBase,
      readConfig: () => ({ project_id: "proj-1" }),
      listTickets: async () => [
        {
          id: "ticket-1",
          shorthand: "PS-1",
          project_id: "proj-1",
          status_id: null,
          title: "Pulled ticket",
          priority: null,
          complexity: null,
          draft: false,
          archived: false,
          status_name: null,
          tag_names: [],
          created_at: "2026-03-04T00:00:00.000Z",
        },
      ],
      getTicket: async () => ({
        id: "ticket-1",
        shorthand: "PS-1",
        project_id: "proj-1",
        status_id: null,
        title: "Pulled ticket",
        input: "# Ticket from DB",
        priority: null,
        complexity: null,
        parent_id: null,
        parallelizable: null,
        blocked_reason: null,
        depends_on: null,
        draft: false,
        archived: false,
        deleted_at: null,
        created_at: "2026-03-04T00:00:00.000Z",
        updated_at: "2026-03-04T00:00:00.000Z",
      }),
      listTicketFiles: async () => [
        {
          id: "file-1",
          project_id: "proj-1",
          file_name: "notes.txt",
          file_kind: "ticket_file",
          storage_path: "/tmp/ignored",
          mime_type: "text/plain",
          size_bytes: 8,
          hash: null,
          created_at: "2026-03-04T00:00:00.000Z",
          updated_at: "2026-03-04T00:00:00.000Z",
        },
      ],
      getTicketFileContent: async () => Buffer.from("new content"),
      log: () => {},
    });

    await expect(handler({ id: "PS-1", force: false, _: [], $0: "" } as never)).rejects.toThrow(
      "Local ticket already exists: PS-1",
    );
  });
});
