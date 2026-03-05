import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createHandler } from "./save";

const tmpBase = join(import.meta.dirname, "__test-tmp-save__");

beforeEach(() => {
  mkdirSync(tmpBase, { recursive: true });
  mkdirSync(join(tmpBase, ".git"), { recursive: true });
  mkdirSync(join(tmpBase, ".pstdio", "tickets", "PS-1_updated-content"), { recursive: true });
  writeFileSync(join(tmpBase, ".pstdio", "tickets", "PS-1_updated-content", "ticket.md"), "# Updated content");
});

afterEach(() => {
  rmSync(tmpBase, { recursive: true, force: true });
});

const ticketFixture = {
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
  tag_names: [] as string[],
  created_at: "2026-03-04T00:00:00.000Z",
};

const baseDeps = {
  cwd: () => tmpBase,
  findGitRoot: () => tmpBase,
  readConfig: () => ({ project_id: "proj-1" }),
  listTickets: async () => [ticketFixture],
  updateTicket: mock(async () => ({
    id: "t-1",
    shorthand: "PS-1",
    project_id: "proj-1",
    status_id: null,
    title: "Saved",
    draft: false,
    created_at: "2026-03-04T00:00:00.000Z",
    updated_at: "2026-03-04T00:00:00.000Z",
  })),
  uploadTicketFile: async () => ({}) as never,
  listTicketStatuses: async () => [
    { id: "s-backlog", name: "backlog", color: "gray", sort_order: 1, is_default: true },
    { id: "s-wip", name: "wip", color: "orange", sort_order: 3, is_default: false },
  ],
  listTicketTags: async () => [] as { id: string; name: string; color: string }[],
  log: mock(),
};

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

    const handler = createHandler({ ...baseDeps, updateTicket, log });

    await handler({ id: "PS-1", _: [], $0: "" } as never);

    expect(updateTicket).toHaveBeenCalledWith(expect.any(String), "t-1", {
      input: "# Updated content",
      draft: false,
      tag_ids: undefined,
      status_id: undefined,
    });
    expect(log).toHaveBeenCalledWith("Saved ticket PS-1");
  });

  test("passes status_id when --status is provided", async () => {
    const updateTicket = mock(async () => ({
      id: "t-1",
      shorthand: "PS-1",
      project_id: "proj-1",
      status_id: "s-wip",
      title: "Saved",
      draft: false,
      created_at: "2026-03-04T00:00:00.000Z",
      updated_at: "2026-03-04T00:00:00.000Z",
    }));

    const handler = createHandler({ ...baseDeps, updateTicket, log: mock() });

    await handler({ id: "PS-1", status: "wip", _: [], $0: "" } as never);

    expect(updateTicket).toHaveBeenCalledWith(
      expect.any(String),
      "t-1",
      expect.objectContaining({ status_id: "s-wip" }),
    );
  });

  test("throws when status not found", async () => {
    const handler = createHandler({ ...baseDeps, log: mock() });

    await expect(handler({ id: "PS-1", status: "nonexistent", _: [], $0: "" } as never)).rejects.toThrow(
      "Status not found: nonexistent",
    );
  });

  test("throws when local file not found", async () => {
    const handler = createHandler({ ...baseDeps, log: () => {} });

    await expect(handler({ id: "PS-999", _: [], $0: "" } as never)).rejects.toThrow("Local ticket not found");
  });

  test("uploads local ticket files and logs upload count", async () => {
    mkdirSync(join(tmpBase, ".pstdio", "tickets", "PS-1_updated-content", "files"), { recursive: true });
    writeFileSync(join(tmpBase, ".pstdio", "tickets", "PS-1_updated-content", "files", "notes.txt"), "file body");

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

    const handler = createHandler({ ...baseDeps, uploadTicketFile, log });

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
