import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { createMemoryRepoFiles, createMemoryStorage } from "@pstdio/sdk/testing";
import { ticketMarkdownPath } from "../data/draft-storage";
import { parseTicketFrontmatter, stripFrontmatter } from "../data/frontmatter";
import { applyTicketTemplateCommand } from "./apply-ticket-template";
import { defaultProjectRoot, makeCommandArgs } from "./command-context.fixture";
import { createTicketCommand } from "./create-ticket";

describe("applyTicketTemplateCommand", () => {
  test("preserves the ticket title and renders ticket placeholders", async () => {
    const storage = createMemoryStorage();
    const projectFiles = createMemoryRepoFiles();
    const ticket = await createTicketCommand.run(
      ...makeCommandArgs({
        storage,
        params: { title: "Existing title" },
        overrides: { project: { id: "proj-1", name: "Test", shorthand: "PS" } },
      }),
    );
    await projectFiles.writeText(
      ticketMarkdownPath("PS-1"),
      "---\nticket_id: PS-1\n---\n\n# Existing title\n\nOld body",
    );

    const result = await applyTicketTemplateCommand.run(
      ...makeCommandArgs({
        storage,
        params: { id: "PS-1", template: "proposal", var: ["DETAIL=kept"] },
        overrides: {
          projectFiles,
          packageFiles: {
            readText: async () => "# {{TICKET_TITLE}}\n\n{{TICKET_ID}} {{DETAIL}}",
          },
        },
      }),
    );

    expect(result).toEqual({ shorthand: "PS-1", path: join(defaultProjectRoot, ticketMarkdownPath("PS-1")) });
    const content = await projectFiles.readText(ticketMarkdownPath("PS-1"));
    expect(stripFrontmatter(content).trim()).toBe("# Existing title\n\nPS-1 kept");
    expect(parseTicketFrontmatter(content).resourceId).toBe(ticket.id);
  });
});
