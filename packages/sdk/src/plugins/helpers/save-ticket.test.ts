import { describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { saveTicket } from "./save-ticket";

const makeTempRoot = () => mkdtempSync(join(tmpdir(), "sdk-save-ticket-"));

const writeLocalTicket = (root: string, shorthand: string, content: string) => {
  const dir = join(root, ".pstdio", "tickets", shorthand);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "ticket.md"), content);
  return dir;
};

type Call = { method: string; args: unknown[] };

const makeCtx = (overrides?: {
  statuses?: { id: string; name: string }[];
  tags?: { options: { id: string; name: string }[] }[];
}) => {
  const calls: Call[] = [];
  const ctx = {
    projectId: "proj-1",
    client: {
      tickets: {
        list: async (projectId: string, input?: unknown) => {
          calls.push({ method: "tickets.list", args: [projectId, input] });
          return [{ id: "ticket-1", shorthand: "PS-1" }];
        },
        update: async (ticketId: string, input: unknown) => {
          calls.push({ method: "tickets.update", args: [ticketId, input] });
          return {};
        },
        uploadFile: async (ticketId: string, input: unknown) => {
          calls.push({ method: "tickets.uploadFile", args: [ticketId, input] });
          return { id: "file-1" };
        },
      },
      statuses: {
        list: async (projectId: string) => {
          calls.push({ method: "statuses.list", args: [projectId] });
          return (
            overrides?.statuses ?? [
              { id: "s-backlog", name: "backlog" },
              { id: "s-wip", name: "wip" },
            ]
          );
        },
      },
      tags: {
        list: async (projectId: string) => {
          calls.push({ method: "tags.list", args: [projectId] });
          return overrides?.tags ?? [{ options: [{ id: "tag-bug", name: "bug" }] }];
        },
      },
    },
  } as never;
  return { ctx, calls };
};

describe("saveTicket", () => {
  it("uploads body without frontmatter and updates ticket with draft=false", async () => {
    const root = makeTempRoot();
    writeLocalTicket(root, "PS-1", "# New title\n\nbody");

    const { ctx, calls } = makeCtx();

    const result = await saveTicket(ctx, { rootPath: root, ticketId: "PS-1" });

    expect(result).toEqual({ ticketShorthand: "PS-1", uploadedFileCount: 0 });

    const upload = calls.find((call) => call.method === "tickets.uploadFile");
    expect(upload?.args[0]).toBe("ticket-1");
    expect(upload?.args[1]).toMatchObject({
      file_name: "ticket.md",
      content_base64: Buffer.from("# New title\n\nbody").toString("base64"),
      mime_type: "text/markdown",
    });

    const update = calls.find((call) => call.method === "tickets.update");
    expect(update?.args[1]).toMatchObject({
      file_id: "file-1",
      display_title: "new-title",
      draft: false,
    });
  });

  it("applies status from frontmatter via ctx.client.statuses", async () => {
    const root = makeTempRoot();
    writeLocalTicket(root, "PS-1", '---\nstatus: "wip"\n---\n\n# T');

    const { ctx, calls } = makeCtx();

    await saveTicket(ctx, { rootPath: root, ticketId: "PS-1" });

    const update = calls.find((call) => call.method === "tickets.update");
    expect(update?.args[1]).toMatchObject({ status_id: "s-wip" });
  });

  it("input.status overrides frontmatter status", async () => {
    const root = makeTempRoot();
    writeLocalTicket(root, "PS-1", '---\nstatus: "wip"\n---\n\n# T');

    const { ctx, calls } = makeCtx();

    await saveTicket(ctx, { rootPath: root, ticketId: "PS-1", status: "backlog" });

    const update = calls.find((call) => call.method === "tickets.update");
    expect(update?.args[1]).toMatchObject({ status_id: "s-backlog" });
  });

  it("resolves tag ids via ctx.client.tags", async () => {
    const root = makeTempRoot();
    writeLocalTicket(root, "PS-1", "# T");

    const { ctx, calls } = makeCtx();

    await saveTicket(ctx, { rootPath: root, ticketId: "PS-1", tags: ["bug"] });

    const update = calls.find((call) => call.method === "tickets.update");
    expect(update?.args[1]).toMatchObject({ tag_ids: ["tag-bug"] });
  });

  it("uploads local ticket files and artifacts with relative_path", async () => {
    const root = makeTempRoot();
    writeLocalTicket(root, "PS-1", "# T");
    mkdirSync(join(root, ".pstdio", "tickets", "PS-1", "files"), { recursive: true });
    writeFileSync(join(root, ".pstdio", "tickets", "PS-1", "files", "notes.txt"), "note");
    mkdirSync(join(root, ".pstdio", "tickets", "PS-1", "artifacts", "checks"), { recursive: true });
    writeFileSync(join(root, ".pstdio", "tickets", "PS-1", "artifacts", "checks", "validate.log"), "log");

    const { ctx, calls } = makeCtx();

    const result = await saveTicket(ctx, { rootPath: root, ticketId: "PS-1" });

    expect(result.uploadedFileCount).toBe(2);
    const uploads = calls.filter((call) => call.method === "tickets.uploadFile");
    expect(uploads).toHaveLength(3);
    expect(uploads[1].args[1]).toMatchObject({ file_name: "notes.txt" });
    expect(uploads[2].args[1]).toMatchObject({ file_name: "validate.log", relative_path: "checks/validate.log" });
  });

  it("rewrites local file with draft: false", async () => {
    const root = makeTempRoot();
    writeLocalTicket(root, "PS-1", "---\ndraft: true\n---\n\n# T");

    const { ctx } = makeCtx();

    await saveTicket(ctx, { rootPath: root, ticketId: "PS-1" });

    const written = readFileSync(join(root, ".pstdio", "tickets", "PS-1", "ticket.md"), "utf8");
    expect(written).toContain("draft: false");
    expect(written).not.toContain("draft: true");
  });

  it("throws when local ticket file is missing", async () => {
    const root = makeTempRoot();
    const { ctx } = makeCtx();

    await expect(saveTicket(ctx, { rootPath: root, ticketId: "PS-1" })).rejects.toThrow(
      "Local ticket not found: .pstdio/tickets/PS-1/ticket.md",
    );
  });
});
