import { describe, expect, test } from "bun:test";
import extension from "./extension";

const nonAssetSurfaces = [
  "activityRenderers",
  "artifactMounts",
  "fileIconThemes",
  "harnesses",
  "hooks",
  "middlewares",
  "migrate",
  "modes",
  "routes",
  "schedules",
  "sessionAnchorRenderers",
  "settings",
  "themes",
  "treeItems",
  "workspaceTypes",
] as const;

describe("pstdio-core-tickets extension", () => {
  test("contributes ticket skills, templates, and ticket actions", () => {
    expect(Object.keys(extension.commands ?? {}).sort()).toEqual([
      "archive-ticket",
      "attach-file",
      "break-into-sub-tickets",
      "create-ticket",
      "delete-ticket",
      "detach-file",
      "get-ticket",
      "query-tickets",
      "refine-ticket",
      "run-attempt",
      "set-ticket-attribute",
      "set-ticket-tags",
      "ticketStatus.create",
      "ticketStatus.delete",
      "ticketStatus.read",
      "ticketStatus.reorder",
      "ticketStatus.update",
      "ticketTag.create",
      "ticketTag.createOption",
      "ticketTag.delete",
      "ticketTag.deleteOption",
      "ticketTag.read",
      "ticketTag.update",
      "ticketTag.updateOption",
      "update-ticket",
    ]);
    expect(Object.keys(extension.skills ?? {}).sort()).toEqual([
      "create_proposal",
      "create_sub_tickets",
      "create_ticket",
      "implement_ticket",
      "refine_ticket",
    ]);
    expect(Object.keys(extension.templates ?? {}).sort()).toEqual([
      "bug_fix",
      "create_sub_tickets",
      "fix_changes_requested",
      "implement_ticket",
      "proposal",
      "refine_ticket",
      "review_code",
      "ticket",
    ]);
    expect(extension.templateTypes).toMatchObject({
      prompt: { label: "Prompt" },
      ticket: { label: "Ticket" },
    });

    expect(extension.commands?.["run-attempt"]?.menus).toEqual([
      { slot: "ticket.headerPrimary", label: "Run attempt" },
    ]);
    expect(extension.commands?.["refine-ticket"]?.menus).toEqual([
      { slot: "ticket.headerOverflow", label: "Refine ticket" },
    ]);
    expect(extension.commands?.["break-into-sub-tickets"]?.menus).toEqual([
      { slot: "ticket.headerOverflow", label: "Break into sub-tickets" },
    ]);

    expect(extension.dataRenderers?.tickets).toMatchObject({
      title: "Tickets",
      resourceKind: "ticket",
    });
    expect(extension.dataRenderers?.tickets?.queryCommand).toEqual({ id: "pstdio-core-tickets.query-tickets" });
    expect(extension.dataRenderers?.tickets?.updateAttributeCommand).toEqual({
      id: "pstdio-core-tickets.set-ticket-attribute",
    });
    expect(extension.dataRenderers?.tickets?.createRow).toMatchObject({
      command: { id: "pstdio-core-tickets.create-ticket" },
      columnParam: "statusId",
    });
    expect(extension.dataRenderers?.tickets?.rowActions?.map((action) => action.id)).toEqual(["archive", "delete"]);
    expect(extension.views?.ticketEditor).toMatchObject({ title: "Ticket", resourceKind: "ticket" });
    expect(extension.views?.ticketEditor?.webview?.capabilities).toEqual([
      "commands.execute",
      "notification.show",
      "files.upload",
      "files.list",
      "files.delete",
    ]);
    expect(extension.views?.createTicketModal).toMatchObject({
      title: "New ticket",
      resourceKind: "ticket",
      surface: "modal",
    });
    expect(extension.views?.createTicketModal?.webview?.capabilities).toEqual([
      "commands.execute",
      "notification.show",
      "files.upload",
      "files.list",
      "files.delete",
    ]);
    expect(extension.settingsPanels?.ticketStatuses).toMatchObject({
      title: "Ticket statuses",
      target: "workbench.settings",
      scope: "project",
    });
    expect(extension.settingsPanels?.ticketTags).toMatchObject({
      title: "Ticket tags",
      target: "workbench.settings",
      scope: "project",
    });
    expect(extension.settingsPanels?.ticketStatuses?.webview?.capabilities).toEqual(["commands.execute"]);
    expect(typeof extension.initialSetup).toBe("function");

    for (const surface of nonAssetSurfaces) {
      expect(extension[surface], surface).toBeUndefined();
    }
  });

  test("run-attempt creates an attempt for the selected ticket", async () => {
    const attempts: unknown[] = [];

    await extension.commands?.["run-attempt"]?.run({
      params: {
        ticket: "PS-304",
        agent: { harnessId: "codex", model: "gpt-5" },
        repo: { repoId: "repo-1", branch: "main" },
      },
      tickets: {
        createAttempt: async (input: unknown) => {
          attempts.push(input);
          return {};
        },
      },
    } as never);

    expect(attempts).toEqual([
      {
        ticket: "PS-304",
        agent: "codex",
        model: "gpt-5",
        repoId: "repo-1",
        branch: "main",
        prompt: "Implement ticket: PS-304",
      },
    ]);
  });

  test("refine-ticket starts a refinement session with optional context", async () => {
    const sessions: unknown[] = [];

    await extension.commands?.["refine-ticket"]?.run({
      params: {
        ticket: "PS-304",
        agent: { harnessId: "codex", model: "gpt-5" },
        template: "bug-fix",
        context: "Tighten the acceptance criteria.",
      },
      sessions: {
        create: async (input: unknown) => {
          sessions.push(input);
          return { id: "session-1" };
        },
      },
    } as never);

    expect(sessions).toEqual([
      {
        title: "Refine ticket: PS-304",
        harness: { harnessId: "codex", model: "gpt-5" },
        template: "refine-ticket",
        vars: {
          ticket: "PS-304",
          templateName: "bug-fix",
          additionalContext: "Tighten the acceptance criteria.",
        },
      },
    ]);
  });

  test("break-into-sub-tickets starts a breakdown session", async () => {
    const sessions: unknown[] = [];

    await extension.commands?.["break-into-sub-tickets"]?.run({
      params: {
        ticket: "PS-304",
        agent: { harnessId: "codex", model: "gpt-5" },
        template: "ticket",
      },
      sessions: {
        create: async (input: unknown) => {
          sessions.push(input);
          return { id: "session-1" };
        },
      },
    } as never);

    expect(sessions).toEqual([
      {
        title: "Break into sub-tickets: PS-304",
        harness: { harnessId: "codex", model: "gpt-5" },
        template: "create-sub-tickets",
        vars: {
          ticket: "PS-304",
          templateName: "ticket",
        },
      },
    ]);
  });
});
