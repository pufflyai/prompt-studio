import { describe, expect, mock, test } from "bun:test";
import type { ExtensionWorkspace } from "@pstdio/sdk/extensions";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { archiveTicketCommand } from "./archive-ticket";
import { makeCommandArgs } from "./command-context.fixture";
import { createTicketCommand } from "./create-ticket";
import { runAttemptCommand } from "./run-attempt";
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
    { linked: false },
    { linked: true },
  ])("archiving a ticket preserves the project folder (linked: $linked)", async ({ linked }) => {
    const storage = createMemoryStorage();
    const ticket = await createTicketCommand.run(...makeCommandArgs({ storage, params: { title: "First" } }));
    const deleteWorkspace = mock(async () => undefined);
    await archiveTicketCommand.run(
      ...makeCommandArgs({
        storage,
        params: {},
        overrides: {
          resource: { type: "ticket", id: ticket.id },
          workspaces: {
            list: async () => [
              {
                ...home,
                anchors_json: linked ? [{ type: "ticket", id: ticket.id, shorthand: ticket.shorthand }] : [],
              },
            ],
            delete: deleteWorkspace,
          },
        },
      }),
    );
    expect(deleteWorkspace).not.toHaveBeenCalled();
  });

  test.each([
    { supportsDelete: false },
    { supportsDelete: true },
  ])("archiving a ticket respects a remote provider's delete capability ($supportsDelete)", async ({
    supportsDelete,
  }) => {
    const storage = createMemoryStorage();
    const ticket = await createTicketCommand.run(...makeCommandArgs({ storage, params: { title: "Remote" } }));
    const remote: ExtensionWorkspace = {
      ...home,
      id: "remote",
      is_default: false,
      provider_id: "example.cloud",
      execution_kind: "remote" as const,
      root_path: null,
      provider_capabilities_json: {
        files: "none",
        diff: false,
        merge: false,
        rebase: false,
        delete: supportsDelete,
      },
      anchors_json: [{ type: "ticket", id: ticket.id, shorthand: ticket.shorthand }],
    };
    const deleteWorkspace = mock(async () => undefined);
    const action = mock(makeCommandArgs({ storage, params: {} })[0].notify.action);
    const result = await archiveTicketCommand.run(
      ...makeCommandArgs({
        storage,
        params: {},
        overrides: {
          resource: { type: "ticket", id: ticket.id },
          workspaces: { list: async () => [remote], delete: deleteWorkspace } as never,
          notify: { action } as never,
        },
      }),
    );
    expect(result?.archived).toBe(true);
    expect(deleteWorkspace).toHaveBeenCalledTimes(supportsDelete ? 1 : 0);
    expect(action).not.toHaveBeenCalled();
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
          workspaces: { list: async () => [home], listProviders: async () => [] },
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
