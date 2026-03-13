import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createHandler } from "./files";

const tmpBase = join(import.meta.dirname, "__test-tmp-files__");

beforeEach(() => {
  mkdirSync(tmpBase, { recursive: true });
  mkdirSync(join(tmpBase, ".git"), { recursive: true });
});

afterEach(() => {
  rmSync(tmpBase, { recursive: true, force: true });
});

describe("tickets files", () => {
  test("prints merged local/db file table", async () => {
    mkdirSync(join(tmpBase, ".pstdio", "tickets", "PS-1", "files"), { recursive: true });
    writeFileSync(join(tmpBase, ".pstdio", "tickets", "PS-1", "files", "both.txt"), "both");
    writeFileSync(join(tmpBase, ".pstdio", "tickets", "PS-1", "files", "local-only.txt"), "local");

    const log = mock();
    const handler = createHandler({
      cwd: () => tmpBase,
      resolveProjectId: () => ({ projectId: "proj-1", root: tmpBase }),
      resolveTicketByShorthand: async () => ({
        id: "ticket-1",
        shorthand: "PS-1",
        project_id: "proj-1",
        status_id: null,
        display_title: "Ticket",
        file_id: null,
        priority: null,
        complexity: null,
        draft: false,
        archived: false,
        status_name: null,
        tag_names: [],
        created_at: "2026-03-04T00:00:00.000Z",
      }),
      listTicketFiles: async () => [
        {
          id: "db-1",
          project_id: "proj-1",
          file_name: "both.txt",
          file_kind: "ticket_file",
          storage_path: "/tmp/both",
          mime_type: "text/plain",
          size_bytes: 4,
          hash: null,
          created_at: "2026-03-04T00:00:00.000Z",
          updated_at: "2026-03-04T00:00:00.000Z",
        },
        {
          id: "db-2",
          project_id: "proj-1",
          file_name: "db-only.txt",
          file_kind: "ticket_file",
          storage_path: "/tmp/db-only",
          mime_type: "text/plain",
          size_bytes: 2,
          hash: null,
          created_at: "2026-03-04T00:00:00.000Z",
          updated_at: "2026-03-04T00:00:00.000Z",
        },
      ],
      log,
    });

    await handler({ id: "PS-1", _: [], $0: "" } as never);

    const table = log.mock.calls[0]?.[0] as string;
    expect(table).toContain("File Name");
    expect(table).toContain("both.txt");
    expect(table).toContain("db-only.txt");
    expect(table).toContain("local-only.txt");
    expect(table).toContain(".pstdio/tickets/PS-1/files/both.txt");
  });

  test("prints empty state when no db or local files exist", async () => {
    const log = mock();
    const handler = createHandler({
      cwd: () => tmpBase,
      resolveProjectId: () => ({ projectId: "proj-1", root: tmpBase }),
      resolveTicketByShorthand: async () => ({
        id: "ticket-1",
        shorthand: "PS-1",
        project_id: "proj-1",
        status_id: null,
        display_title: "Ticket",
        file_id: null,
        priority: null,
        complexity: null,
        draft: false,
        archived: false,
        status_name: null,
        tag_names: [],
        created_at: "2026-03-04T00:00:00.000Z",
      }),
      listTicketFiles: async () => [],
      log,
    });

    await handler({ id: "PS-1", _: [], $0: "" } as never);

    expect(log).toHaveBeenCalledWith("No ticket files found.");
  });
});
