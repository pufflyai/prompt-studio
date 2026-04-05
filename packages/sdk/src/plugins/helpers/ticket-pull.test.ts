import { describe, expect, it } from "bun:test";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pullTickets } from "./ticket-pull";

const makeTempRoot = () => mkdtempSync(join(tmpdir(), "sdk-ticket-pull-"));

describe("pullTickets", () => {
  it("pulls a single ticket with frontmatter and attachments when ticketId is shorthand", async () => {
    const root = makeTempRoot();

    const listCalls: unknown[] = [];
    const fileContentCalls: unknown[] = [];

    const ctx = {
      projectId: "proj-1",
      client: {
        tickets: {
          list: async (projectId: string, input?: unknown) => {
            listCalls.push([projectId, input]);
            return [
              {
                id: "ticket-1",
                shorthand: "PS-1",
                status_name: "wip",
                tag_names: ["bug"],
                archived: false,
              },
            ];
          },
          get: async (ticketId: string) => {
            if (ticketId !== "ticket-1") {
              throw { status: 404 };
            }

            return {
              id: "ticket-1",
              shorthand: "PS-1",
              created_at: "2026-01-01T00:00:00.000Z",
              draft: false,
              parent_id: null,
              user_prompt: "Do it",
              depends_on: null,
              parallelizable: null,
              blocked_reason: null,
              file_id: "body-file",
              content: "# Ticket body\n",
            };
          },
          listFiles: async () => [
            { id: "body-file", file_name: "ticket.md" },
            { id: "file-2", file_name: "notes.txt" },
          ],
          getFileContent: async (ticketId: string, fileId: string) => {
            fileContentCalls.push([ticketId, fileId]);
            return new Uint8Array(Buffer.from("attachment-body", "utf8"));
          },
        },
      },
    } as never;

    const result = await pullTickets(ctx, { rootPath: root, ticketId: "PS-1" });

    expect(result).toEqual({ pulledTicketShorthands: ["PS-1"], downloadedFileCount: 1 });

    const ticketFilePath = join(root, ".pstdio", "tickets", "PS-1", "ticket.md");
    expect(existsSync(ticketFilePath)).toBe(true);
    expect(readFileSync(ticketFilePath, "utf8")).toContain('ticket_id: "PS-1"');
    expect(readFileSync(ticketFilePath, "utf8")).toContain('status: "wip"');
    expect(readFileSync(ticketFilePath, "utf8")).toContain("# Ticket body");

    const attachmentPath = join(root, ".pstdio", "tickets", "PS-1", "files", "notes.txt");
    expect(readFileSync(attachmentPath, "utf8")).toBe("attachment-body");
    expect(fileContentCalls).toEqual([["ticket-1", "file-2"]]);
    expect(listCalls).toEqual([["proj-1", { shorthand: "PS-1" }]]);
  });

  it("pulls all non-archived tickets when no ticket ref is provided", async () => {
    const root = makeTempRoot();
    const listCalls: unknown[] = [];

    const ctx = {
      projectId: "proj-1",
      client: {
        tickets: {
          list: async (projectId: string, input?: unknown) => {
            listCalls.push([projectId, input]);
            return [
              {
                id: "ticket-1",
                shorthand: "PS-1",
                status_name: "wip",
                tag_names: [],
                archived: false,
              },
              {
                id: "ticket-2",
                shorthand: "PS-2",
                status_name: null,
                tag_names: [],
                archived: true,
              },
            ];
          },
          get: async (id: string) => ({
            id,
            shorthand: id === "ticket-1" ? "PS-1" : "PS-2",
            created_at: "2026-01-01T00:00:00.000Z",
            draft: false,
            parent_id: null,
            user_prompt: null,
            depends_on: null,
            parallelizable: null,
            blocked_reason: null,
            file_id: null,
            content: "",
          }),
          listFiles: async () => [],
          getFileContent: async () => new Uint8Array(),
        },
      },
    } as never;

    const result = await pullTickets(ctx, { rootPath: root });

    expect(result).toEqual({ pulledTicketShorthands: ["PS-1"], downloadedFileCount: 0 });
    expect(listCalls).toEqual([["proj-1", { archived: false }]]);
  });
});
