import { describe, expect, test } from "bun:test";
import extension from "./extension";
import { putTicket, ticketsCollection } from "./src/data/collections";
import { createMemoryStorage } from "./src/data/memory-storage";
import { seedDefaultStatuses } from "./src/data/seed";
import type { StoredTicket } from "./src/data/types";

const seedBacklogTicket = async (storage: ReturnType<typeof createMemoryStorage>) =>
  putTicket(storage, {
    id: "ticket-1",
    shorthand: "T-1",
    title: "Ticket",
    content: "# Ticket",
    statusId: "default-backlog",
    tagIds: [],
    attachments: [],
    parentId: null,
    dependsOn: null,
    blockedReason: null,
    userPrompt: null,
    parallelizable: null,
    draft: false,
    archived: false,
    sortOrder: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  } satisfies StoredTicket);

describe("pstdio planner extension contributions", () => {
  test("uses a native tree renderer for ticket files", () => {
    expect(extension.treeRenderers?.ticketFiles).toMatchObject({
      title: { $l10n: "treeRenderers.ticketFiles.title", default: "Files" },
      bodyCommand: { id: "pstdio-planner.ticket-files.tree.body" },
      defaultExpandedSectionIds: ["files", "sub-tickets", "workspaces"],
    });
    expect(extension.views?.ticketFiles).toMatchObject({
      title: { $l10n: "views.ticketFiles.title", default: "Files" },
      resourceKind: "ticket",
      target: "workbench.main.left",
      surface: "panel",
      treeRenderer: "ticketFiles",
    });
    expect(extension.views?.ticketFiles).not.toHaveProperty("webview");
  });

  test("contributes shared document templates and planner skills", () => {
    expect(extension.templateTypes?.document).toMatchObject({ label: "Document" });
    expect(extension.templates?.prd).toMatchObject({ title: "PRD", type: "document" });
    expect(extension.templates?.commit_message).toMatchObject({ title: "Commit message", type: "prompt" });
    expect(extension.skills?.create_ticket).toMatchObject({ title: "Create a ticket" });
    expect(extension.skills).not.toHaveProperty("create_pstdio_extension");
    expect(extension.skills).not.toHaveProperty("pstdio");
  });

  test("owns planner translation bundles and localizable contribution copy", () => {
    expect(extension.defaultLocale).toBe("en");
    expect(extension.translations).toEqual({
      es: expect.objectContaining({ kind: "package-asset" }),
      fr: expect.objectContaining({ kind: "package-asset" }),
      ja: expect.objectContaining({ kind: "package-asset" }),
      ko: expect.objectContaining({ kind: "package-asset" }),
      "zh-Hans": expect.objectContaining({ kind: "package-asset" }),
      "zh-Hant": expect.objectContaining({ kind: "package-asset" }),
    });
    expect(extension.dataRenderers?.tickets?.title).toEqual({
      $l10n: "dataRenderers.tickets.title",
      default: "Tickets",
    });
    expect(extension.views?.createTicketModal?.title).toEqual({
      $l10n: "views.createTicketModal.title",
      default: "New ticket",
    });
    expect(extension.settingsPanels?.ticketStatuses?.title).toEqual({
      $l10n: "settingsPanels.ticketStatuses.title",
      default: "Ticket statuses",
    });
  });

  test("bootstraps project config when a ticket worktree is created", async () => {
    const bootstraps: unknown[] = [];

    await extension.hooks?.worktreeCreated.handler(
      {
        worktrees: {
          bootstrap: async (input: unknown) => {
            bootstraps.push(input);
          },
        },
      } as never,
      {
        branch: "workspace/PS-1_A1",
        projectId: "project-1",
        repoPath: "/repo",
        ticket: "PS-1",
        workspace: "PS-1_A1",
        workspaceId: "workspace-1",
        worktreePath: "/worktree",
      },
    );

    expect(bootstraps).toEqual([{ repoPath: "/repo", worktreePath: "/worktree" }]);
  });

  test("moves a ticket to in-progress when a session starts for it", async () => {
    const storage = createMemoryStorage();
    await seedDefaultStatuses(storage);
    const ticket = await seedBacklogTicket(storage);

    await extension.hooks?.sessionStarted.handler(
      { storage } as never,
      {
        projectId: "project-1",
        sessionId: "s1",
        workspace: {
          anchors_json: [
            { type: "ticket", id: ticket.id, label: ticket.shorthand, metadata: { shorthand: ticket.shorthand } },
          ],
        },
      } as never,
    );

    expect((await ticketsCollection(storage).get(ticket.id))!.statusId).toBe("default-in-progress");
  });

  test("session start without a linked ticket is a no-op", async () => {
    const storage = createMemoryStorage();
    await seedDefaultStatuses(storage);

    await expect(
      extension.hooks?.sessionStarted.handler(
        { storage } as never,
        {
          projectId: "project-1",
          sessionId: "s1",
        } as never,
      ),
    ).resolves.toBeUndefined();
  });

  test("mounts workspace-scoped actions in workbench top actions", () => {
    expect(extension.commands?.runReview?.menus).toEqual([
      {
        target: "workbench.nav.actions",
        label: { $l10n: "commands.runReview.menuLabel", default: "Run review" },
        icon: "clipboard-check",
        when: { resourceType: ["workspace"] },
      },
    ]);
  });

  test("runReview gets workspace identity from dashboard resource context", () => {
    expect(extension.commands?.runReview?.params?.workspaceId).toMatchObject({ required: false });
  });

  test("opens the tickets datatable as a board with core properties displayed", () => {
    expect(extension.dataRenderers?.tickets?.defaultSettings).toMatchObject({
      viewMode: "board",
      columnGrouping: "status",
      displayProperties: ["id", "workspace", "type", "priority"],
    });
  });

  test("exposes ticket workspace creation as an extension-owned row action", () => {
    expect(extension.dataRenderers?.tickets?.rowActions).toContainEqual({
      id: "create-workspace",
      label: { $l10n: "dataRenderers.tickets.rowActions.createWorkspace", default: "Create workspace" },
      icon: "git-branch",
      command: { id: "pstdio-planner.create-workspace" },
    });
  });

  test("contributes a project settings panel for workspace statuses", () => {
    const panel = extension.settingsPanels?.workspaceStatuses;

    expect(panel).toMatchObject({
      title: { $l10n: "settingsPanels.workspaceStatuses.title", default: "Workspace statuses" },
      target: "workbench.settings",
      scope: "project",
      webview: expect.objectContaining({
        capabilities: ["commands.execute"],
      }),
    });
  });
});
