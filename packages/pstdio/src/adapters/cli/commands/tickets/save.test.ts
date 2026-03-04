import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createHandler } from "./save";

const tmpBase = join(import.meta.dirname, "__test-tmp-save__");

beforeEach(() => {
  mkdirSync(tmpBase, { recursive: true });
  mkdirSync(join(tmpBase, ".git"), { recursive: true });
  mkdirSync(join(tmpBase, ".pstdio", "tickets", "PS-1"), { recursive: true });
  writeFileSync(join(tmpBase, ".pstdio", "tickets", "PS-1", "ticket.md"), "# Updated content");
});

afterEach(() => {
  rmSync(tmpBase, { recursive: true, force: true });
});

describe("tickets save", () => {
  test("pushes local file content to database", async () => {
    const log = mock();
    const updateTicket = mock(async () => ({
      id: "t-1",
      shorthand: "PS-1",
      project_id: "proj-1",
      status_id: null,
      title: "Saved",
      draft: false,
      created_at: "2026-03-04T00:00:00.000Z",
      updated_at: "2026-03-04T00:00:00.000Z",
    }));

    const handler = createHandler({
      cwd: () => tmpBase,
      findGitRoot: () => tmpBase,
      readConfig: () => ({ project_id: "proj-1" }),
      listTickets: async () => [
        {
          id: "t-1",
          shorthand: "PS-1",
          project_id: "proj-1",
          status_id: null,
          title: "Draft",
          priority: null,
          complexity: null,
          draft: true,
          archived: false,
          status_name: null,
          tag_names: [],
          created_at: "2026-03-04T00:00:00.000Z",
        },
      ],
      updateTicket,
      uploadTicketFile: async () => ({}) as never,
      listTicketTags: async () => [],
      log,
    });

    await handler({ id: "PS-1", _: [], $0: "" } as never);

    expect(updateTicket).toHaveBeenCalledWith(expect.any(String), "t-1", {
      input: "# Updated content",
      draft: false,
      tag_ids: undefined,
    });
    expect(log).toHaveBeenCalledWith("Saved ticket PS-1");
  });

  test("throws when local file not found", async () => {
    const handler = createHandler({
      cwd: () => tmpBase,
      findGitRoot: () => tmpBase,
      readConfig: () => ({ project_id: "proj-1" }),
      listTickets: async () => [],
      updateTicket: async () => ({}) as never,
      uploadTicketFile: async () => ({}) as never,
      listTicketTags: async () => [],
      log: () => {},
    });

    await expect(handler({ id: "PS-999", _: [], $0: "" } as never)).rejects.toThrow("Local ticket not found");
  });

  test("uploads local ticket files and logs upload count", async () => {
    mkdirSync(join(tmpBase, ".pstdio", "tickets", "PS-1", "files"), { recursive: true });
    writeFileSync(join(tmpBase, ".pstdio", "tickets", "PS-1", "files", "notes.txt"), "file body");

    const log = mock();
    const uploadTicketFile = mock(async () => ({
      id: "file-1",
      project_id: "proj-1",
      file_name: "notes.txt",
      file_kind: "ticket_file",
      storage_path: "/tmp/file",
      mime_type: "text/plain",
      size_bytes: 9,
      hash: null,
      created_at: "2026-03-04T00:00:00.000Z",
      updated_at: "2026-03-04T00:00:00.000Z",
    }));

    const handler = createHandler({
      cwd: () => tmpBase,
      findGitRoot: () => tmpBase,
      readConfig: () => ({ project_id: "proj-1" }),
      listTickets: async () => [
        {
          id: "t-1",
          shorthand: "PS-1",
          project_id: "proj-1",
          status_id: null,
          title: "Draft",
          priority: null,
          complexity: null,
          draft: true,
          archived: false,
          status_name: null,
          tag_names: [],
          created_at: "2026-03-04T00:00:00.000Z",
        },
      ],
      updateTicket: async () =>
        ({
          id: "t-1",
          shorthand: "PS-1",
          project_id: "proj-1",
          status_id: null,
          title: "Saved",
          draft: false,
          created_at: "2026-03-04T00:00:00.000Z",
          updated_at: "2026-03-04T00:00:00.000Z",
        }) as never,
      uploadTicketFile,
      listTicketTags: async () => [],
      log,
    });

    await handler({ id: "PS-1", _: [], $0: "" } as never);

    expect(uploadTicketFile).toHaveBeenCalledWith(expect.any(String), "t-1", {
      file_name: "notes.txt",
      content_base64: Buffer.from("file body").toString("base64"),
      mime_type: undefined,
    });
    expect(log).toHaveBeenCalledWith("Saved ticket PS-1");
    expect(log).toHaveBeenCalledWith("Uploaded 1 ticket files");
  });
});
