import { describe, expect, test } from "bun:test";
import { ticketMarkdownPath } from "../data/draft-storage";
import { createMemoryStorage } from "../data/memory-storage";
import { applyTicketTemplateCommand } from "./apply-ticket-template";
import { makeCommandArgs } from "./command-context.fixture";
import { createMemoryRepoFiles } from "./repo-files.fixture";

describe("applyTicketTemplateCommand", () => {
  test("preserves the ticket title and renders ticket placeholders", async () => {
    const storage = createMemoryStorage();
    const repoFiles = createMemoryRepoFiles();
    await repoFiles.writeText(ticketMarkdownPath("PS-1"), "---\nticket_id: PS-1\n---\n\n# Existing title\n\nOld body");

    const result = await applyTicketTemplateCommand.run(
      ...makeCommandArgs({
        storage,
        params: { id: "PS-1", template: "proposal", var: ["DETAIL=kept"] },
        overrides: {
          repoFiles,
          packageFiles: {
            readText: async () => "# {{TICKET_TITLE}}\n\n{{TICKET_ID}} {{DETAIL}}",
          },
        },
      }),
    );

    expect(result).toEqual({ shorthand: "PS-1", path: ticketMarkdownPath("PS-1") });
    expect(await repoFiles.readText(ticketMarkdownPath("PS-1"))).toBe("# Existing title\n\nPS-1 kept");
    expect(await repoFiles.readText(".pstdio/.gitignore")).toBe("/tickets\n");
  });
});
