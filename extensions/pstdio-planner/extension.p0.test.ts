import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import extension from "./extension";
import { fixture } from "./src/commands/auto-build.fixture";
import { ticketMarkdownPath } from "./src/data/draft-storage";
import { observeStorageReads } from "./src/data/storage-reads.fixture";
import { putTicket, ticketContext, ticketsCollection } from "./src/data/ticket-context.fixture";
import type { Ticket } from "./src/data/types";
import { plannerTicketsChanged } from "./src/events";

const hook = (id: string) => extension.hooks?.find((contribution) => contribution.id === id);
const fileMount = (root: string) => ({
  exists: async (path: string) => existsSync(join(root, path)),
  readText: async (path: string) => readFileSync(join(root, path), "utf8"),
  writeText: async (path: string, content: string) => {
    const absolutePath = join(root, path);
    mkdirSync(join(absolutePath, ".."), { recursive: true });
    writeFileSync(absolutePath, content);
  },
});
const seedBacklogTicket = async (storage: ReturnType<typeof createMemoryStorage>) =>
  putTicket(storage, {
    id: "ticket-1",
    shorthand: "T-1",
    title: "Ticket",
    content: "# Ticket",
    statusId: "backlog",
    tagIds: [],
    attachments: [],
    parentId: null,
    dependsOn: null,
    blockedReason: null,
    userPrompt: null,
    draft: false,
    archived: false,
    sortOrder: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  } satisfies Ticket);
describe("pstdio planner extension contributions", () => {
  test("registers each command once", () => {
    const ids = (extension.commands ?? []).map(({ id }) => id);
    expect(ids.filter((id, index) => ids.indexOf(id) !== index)).toEqual([]);
  });
});
describe("pstdio planner workspace contributions", () => {
  test("copies the linked ticket file when a ticket worktree is created", async () => {
    const storage = createMemoryStorage();
    const ticket = await seedBacklogTicket(storage);
    const worktreePath = mkdtempSync(join(tmpdir(), "planner-worktree-"));
    try {
      await hook("worktree-created")?.run(
        {
          ...ticketContext(storage),
          projectFiles: fileMount(worktreePath),
          workspaceFiles: fileMount(worktreePath),
        } as never,
        {
          projectId: "project-1",
          workspaceId: "workspace-1",
          repoPath: "/repo",
          workspaceDir: worktreePath,
          type: "worktree",
          branch: "workspace/T-1_A1",
          workspace: {
            id: "workspace-1",
            execution_kind: "local",
            anchors_json: [
              { type: "ticket", id: ticket.id, label: ticket.shorthand, shorthand: ticket.shorthand, metadata: {} },
            ],
          },
        },
      );
      const path = join(worktreePath, ticketMarkdownPath(ticket.shorthand));
      expect(existsSync(path)).toBe(true);
      expect(readFileSync(path, "utf8")).toContain(ticket.content);
    } finally {
      rmSync(worktreePath, { recursive: true, force: true });
    }
  });
  test("copies an existing local ticket file into a ticket worktree", async () => {
    const storage = createMemoryStorage();
    const ticket = await seedBacklogTicket(storage);
    const repoPath = mkdtempSync(join(tmpdir(), "planner-repo-"));
    const worktreePath = mkdtempSync(join(tmpdir(), "planner-worktree-"));
    const repoTicketPath = join(repoPath, ticketMarkdownPath(ticket.shorthand));
    const localContent = "# Local ticket edits\n";
    mkdirSync(join(repoPath, ".pstdio", "extension-storage", "pstdio.planner", "tickets", ticket.shorthand), {
      recursive: true,
    });
    writeFileSync(repoTicketPath, localContent);
    try {
      await hook("worktree-created")?.run(
        {
          ...ticketContext(storage),
          projectFiles: fileMount(repoPath),
          workspaceFiles: fileMount(worktreePath),
        } as never,
        {
          projectId: "project-1",
          workspaceId: "workspace-1",
          repoPath,
          workspaceDir: worktreePath,
          type: "worktree",
          branch: "workspace/T-1_A1",
          workspace: {
            id: "workspace-1",
            execution_kind: "local",
            anchors_json: [
              { type: "ticket", id: ticket.id, label: ticket.shorthand, shorthand: ticket.shorthand, metadata: {} },
            ],
          },
        },
      );
      expect(readFileSync(join(worktreePath, ticketMarkdownPath(ticket.shorthand)), "utf8")).toBe(localContent);
    } finally {
      rmSync(repoPath, { recursive: true, force: true });
      rmSync(worktreePath, { recursive: true, force: true });
    }
  });
});
describe("pstdio planner notification hooks", () => {
  test("creates blocked notifications from session anchors when workspace anchors are empty", async () => {
    const storage = createMemoryStorage();
    const ticket = await seedBacklogTicket(storage);
    const notifications: unknown[] = [];
    await hook("session-awaiting-input")?.run(
      {
        ...ticketContext(storage),
        notify: {
          action: async (input: unknown) => {
            notifications.push(input);
            return {};
          },
        },
      } as never,
      {
        projectId: "project-1",
        sessionId: "session-1",
        workspace: { anchors_json: [] },
        anchors: [{ type: "ticket", id: ticket.id, label: ticket.shorthand }],
      } as never,
    );
    expect(notifications).toEqual([
      expect.objectContaining({
        dedupeKey: `pstdio-planner:ticket:${ticket.id}:blocked`,
        kind: "blocked",
      }),
    ]);
  });
});

test("ticket change hooks read only the changed ticket, so saves stay fast in large projects", async () => {
  const { ctx, ticket, storage } = await fixture();
  const prerequisite = await ticket("Unfinished prerequisite");
  const changed = await ticket("Changed ticket", [prerequisite.id]);
  for (let index = 0; index < 20; index++) await ticket(`Other ticket ${index}`);
  // Older tickets can still store the dependency-only sentence; opening the project removes it.
  await ticketsCollection(storage).put(changed.id, {
    ...(await ticketsCollection(storage).get(changed.id))!,
    blockedReason: `Complete ${prerequisite.shorthand} before implementing this dependent contract.`,
  });
  await hook("dependency-blockers.project-opened")!.run(
    { ...ctx, eventId: "project.opened", deliveryId: "open" },
    { projectId: ctx.projectId },
  );
  const observed = observeStorageReads(storage);
  const hooks = extension.hooks?.filter((contribution) => contribution.event.id === plannerTicketsChanged.id) ?? [];

  expect(hooks.length).toBeGreaterThan(0);
  for (const contribution of hooks)
    await contribution.run(
      { ...ctx, storage: observed.storage, eventId: contribution.event.id, deliveryId: `check-${contribution.id}` },
      { projectId: ctx.projectId, ticketId: changed.id },
    );

  expect(observed.reads).not.toContain("tickets/*");
});
