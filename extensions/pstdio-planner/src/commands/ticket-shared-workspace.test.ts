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
  test("archiving a ticket preserves the shared workspace", async () => {
    const storage = createMemoryStorage();
    const ticket = await createTicketCommand.run(...makeCommandArgs({ storage, params: { title: "First" } }));
    const archive = mock(async () => home);
    await archiveTicketCommand.run(
      ...makeCommandArgs({
        storage,
        params: {},
        overrides: {
          resource: { type: "ticket", id: ticket.id },
          workspaces: { list: async () => [home], archive },
        },
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
