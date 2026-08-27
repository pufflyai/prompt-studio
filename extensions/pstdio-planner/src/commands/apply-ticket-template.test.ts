import { describe, expect, test } from "bun:test";
import { createMemoryStorage } from "../data/memory-storage";
import { ticketMarkdownPath } from "../data/draft-storage";
import { makeCommandArgs } from "./command-context.fixture";
import { createMemoryRepoFiles } from "./repo-files.fixture";
import { applyTicketTemplateCommand } from "./apply-ticket-template";

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
          templates: {
            get: async () => ({
              id: "template-1",
              project_id: "project-1",
              name: "proposal",
              title: "Proposal",
              template_type: "ticket",
              source_kind: "extension",
              is_default: false,
              editable: true,
              content: "# {{TICKET_TITLE}}\n\n{{TICKET_ID}} {{DETAIL}}",
              created_at: "2026-01-01T00:00:00.000Z",
              updated_at: "2026-01-01T00:00:00.000Z",
              deleted_at: null,
            }),
          },
        },
      }),
    );

    expect(result).toEqual({ shorthand: "PS-1", path: ticketMarkdownPath("PS-1") });
    expect(await repoFiles.readText(ticketMarkdownPath("PS-1"))).toBe("# Existing title\n\nPS-1 kept");
    expect(await repoFiles.readText(".pstdio/.gitignore")).toBe("/tickets\n");
  });
});
