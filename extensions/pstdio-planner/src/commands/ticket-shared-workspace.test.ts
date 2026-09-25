import { describe, expect, mock, test } from "bun:test";
import type { ExtensionWorkspace } from "@pstdio/sdk/extensions";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { archiveTicketCommand } from "./archive-ticket";
import { makeCommandArgs } from "./command-context.fixture";
import { createTicketCommand } from "./create-ticket";
import { runAttemptCommand } from "./run-attempt";
import { createWorkspaceCommand } from "./ticket-actions";
import { listTicketFilesTreeCommand } from "./ticket-files";

const home: ExtensionWorkspace = {
  id: "home",
  name: "Project folder",
  is_default: true,
  provider_id: "pstdio.root",
  provider_state: "ready",
  execution_kind: "local",
  root_path: "/notes/123 笔记",
  anchors_json: [],
};

describe("ticket work in shared folders", () => {
  test.each([
    [{ ...home, initializing: true }, "setup is still running"],
    [{ ...home, root_path: null }, "Attach a project folder"],
  ] as const)("does not open an unavailable default workspace: %j", async (workspace, error) => {
    await expect(
      createWorkspaceCommand.run(
        ...makeCommandArgs({
          storage: createMemoryStorage(),
          params: { ticket: "T-1" },
          overrides: { workspaces: { getDefault: async () => workspace, listProviders: async () => [] } },
        }),
      ),
    ).rejects.toThrow(error);
  });

  test("archiving a ticket preserves the shared workspace", async () => {
    const storage = createMemoryStorage();
    const ticket = await createTicketCommand.run(...makeCommandArgs({ storage, params: { title: "First" } }));
    const archive = mock(async () => home);
    await archiveTicketCommand.run(
      ...makeCommandArgs({
        storage,
        params: { ticket: ticket.id },
        overrides: { workspaces: { list: async () => [home], archive } },
      }),
    );
    expect(archive).not.toHaveBeenCalled();
  });

  test("managed attempts still require a usable Git provider", async () => {
    await expect(
      runAttemptCommand.run(
        ...makeCommandArgs({
          storage: createMemoryStorage(),
          params: { ticket: "T-1" },
          overrides: { workspaces: { getDefault: async () => home, listProviders: async () => [] } },
        }),
      ),
    ).rejects.toThrow("Planner attempts require a Git repository");
  });

  test("reuses the exact project workspace for multiple tickets without creating Git worktrees", async () => {
    const storage = createMemoryStorage();
    const create = mock(async () => {
      throw new Error("Git is unavailable");
    });
    for (const title of ["First", "Second"]) {
      const ticket = await createTicketCommand.run(...makeCommandArgs({ storage, params: { title } }));
      const result = await createWorkspaceCommand.run(
        ...makeCommandArgs({
          storage,
          params: { ticket: ticket.id },
          overrides: {
            workspaces: {
              getDefault: async () => home,
              listProviders: async () => [{ id: "pstdio.root", label: "Project folder", params: {} }],
              create,
            },
          },
        }),
      );
      expect(result).toMatchObject({ mode: "shared", workspace: home, session: null });
    }
    expect(create).not.toHaveBeenCalled();
    expect(home.anchors_json).toEqual([]);
  });

  test("reuses a remote project workspace without inventing a local path", async () => {
    const remote = { ...home, provider_id: "cloud.workspace", root_path: null, execution_kind: "remote" as const };
    const result = await createWorkspaceCommand.run(
      ...makeCommandArgs({
        storage: createMemoryStorage(),
        params: { ticket: "T-1" },
        overrides: { workspaces: { getDefault: async () => remote, listProviders: async () => [] } },
      }),
    );
    expect(result.workspace).toEqual(remote);
    expect(result.mode).toBe("shared");
  });

  test("reports a provider setup failure instead of returning a broken workspace", async () => {
    await expect(
      createWorkspaceCommand.run(
        ...makeCommandArgs({
          storage: createMemoryStorage(),
          params: { ticket: "T-1" },
          overrides: {
            workspaces: {
              create: async () => ({ id: "failed", provider_state: "failed" }),
              resolve: async () => ({
                state: "failed",
                executionKind: "local",
                capabilities: { files: "none", diff: false, merge: false, rebase: false, archive: true, delete: true },
                error: {
                  code: "provider_create_failed",
                  message: "The base revision has no selected subfolder.",
                  retryable: true,
                },
              }),
            },
          },
        }),
      ),
    ).rejects.toThrow("The base revision has no selected subfolder.");
  });

  test("shows the shared folder on a ticket without including other tickets' sessions", async () => {
    const storage = createMemoryStorage();
    const ticket = await createTicketCommand.run(...makeCommandArgs({ storage, params: { title: "First" } }));
    const otherSession = {
      id: "other",
      title: "Another ticket's session",
      status: "completed",
      anchors_json: [{ type: "ticket", id: "other-ticket" }],
    };
    const listByWorkspace = mock(async () => [otherSession]);
    const sections = await listTicketFilesTreeCommand.run(
      ...makeCommandArgs({
        storage,
        params: {
          renderer: {
            rendererId: "pstdio.pstdio-planner.view.ticket-files",
            resource: { type: "ticket", id: ticket.id },
          },
        },
        overrides: {
          workspaces: { list: async () => [home] },
          sessions: { list: async () => [otherSession], listByWorkspace } as never,
        },
      }),
    );
    expect(sections.find((section) => section.id === "workspaces")?.nodes).toEqual([
      expect.objectContaining({
        id: "workspace-home",
        icon: "Folder",
        resource: expect.objectContaining({
          id: "home",
          metadata: expect.objectContaining({ workspaceType: "folder" }),
        }),
      }),
    ]);
    expect(sections.find((section) => section.id === "sessions")?.nodes).toEqual([
      expect.objectContaining({ id: "sessions-empty" }),
    ]);
    expect(listByWorkspace).not.toHaveBeenCalled();
  });
});
