import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { loadExtensionRuntime } from "./index";

const cookbookProjectRoot = join(import.meta.dir, "__fixtures__", "cookbook-project");

describe("cookbook fixture extensions", () => {
  test("compile against the extension SDK and load through the runtime", async () => {
    const runtime = await loadExtensionRuntime({ projectRoot: cookbookProjectRoot });

    expect(runtime.diagnostics).toEqual([]);
    expect(runtime.extensions.map((extension) => extension.id).sort()).toEqual([
      "project.review",
      "project.templates",
      "project.tickets",
      "project.wrapper",
      "pstdio.harness.claude-code",
      "pstdio.harness.opencode",
      "pstdio.planner",
      "pstdio.workspace-changes",
    ]);

    expect(runtime.commands.map((command) => command.id).sort()).toEqual([
      "project.review.runReview",
      "project.wrapper.refresh",
      "pstdio.planner.archiveTicket",
      "pstdio.planner.createStatus",
      "pstdio.planner.createTag",
      "pstdio.planner.createTagOption",
      "pstdio.planner.createTicket",
      "pstdio.planner.deleteStatus",
      "pstdio.planner.deleteTag",
      "pstdio.planner.deleteTagOption",
      "pstdio.planner.deleteTicket",
      "pstdio.planner.implementTicket",
      "pstdio.planner.listStatuses",
      "pstdio.planner.listTags",
      "pstdio.planner.listTicketFiles",
      "pstdio.planner.listTicketWorkspaces",
      "pstdio.planner.listTicketWorktrees",
      "pstdio.planner.listTickets",
      "pstdio.planner.pullTickets",
      "pstdio.planner.pushTicket",
      "pstdio.planner.removeTicketWorktrees",
      "pstdio.planner.saveTicket",
      "pstdio.planner.setDefaultStatus",
      "pstdio.planner.updateStatus",
      "pstdio.planner.updateTag",
      "pstdio.planner.updateTagOption",
      "pstdio.planner.updateTicket",
      "pstdio.planner.updateTicketWhenAttemptStatus",
      "pstdio.planner.uploadTicketFile",
      "pstdio.planner.viewTicket",
      "pstdio.planner.writeTicket",
    ]);
    expect(runtime.cli.map((cli) => cli.path).sort()).toEqual([
      "tickets archive",
      "tickets create",
      "tickets delete",
      "tickets files",
      "tickets implement",
      "tickets list",
      "tickets pull",
      "tickets push",
      "tickets save",
      "tickets update",
      "tickets update-when-attempt-status",
      "tickets view",
      "tickets workspaces",
      "tickets worktrees list",
      "tickets worktrees remove-all",
      "tickets write",
      "workspaces review",
    ]);
    expect(runtime.artifactMounts.map((mount) => mount.path)).toEqual([".pstdio/tickets"]);
    expect(runtime.templateTypes[0]?.id).toBe("project.templates.ticket");
    expect(runtime.templates[0]?.source.kind).toBe("package-asset");
    expect(runtime.harnesses.map((harness) => harness.id).sort()).toEqual([
      "pstdio.harness.claude-code",
      "pstdio.harness.opencode",
    ]);
  });
});
