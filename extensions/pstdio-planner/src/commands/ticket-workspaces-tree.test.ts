import { describe, expect, test } from "bun:test";
import { workbenchPages } from "@pstdio/sdk/extensions";
import { createMemoryStorage } from "../data/memory-storage";
import { makeCommandArgs } from "./command-context.fixture";
import { createTicketCommand } from "./create-ticket";
import { createWorkspaceCommand } from "./ticket-actions";
import { listTicketFilesTreeCommand } from "./ticket-files";

const createWorkspaceTreeActionParams = {
  repo: createWorkspaceCommand.params!.repo,
  mode: createWorkspaceCommand.params!.mode,
};

const ticketRendererParams = (ticket: { id: string; shorthand: string }, documentId?: string) => ({
  renderer: {
    rendererId: "pstdio.pstdio-planner.view.ticket-files",
    resource: {
      type: "ticket",
      id: ticket.id,
      label: ticket.shorthand,
      ...(documentId ? { metadata: { documentId } } : {}),
    },
  },
});

describe("ticket files tree workspace commands", () => {
  test("appends a Workspaces section for linked workspaces and excludes unrelated ones", async () => {
    const storage = createMemoryStorage();
    const ticket = await createTicketCommand.run(...makeCommandArgs({ storage, params: { title: "Ticket" } }));

    const linked = {
      id: "ws-1",
      workspace_shorthand: "WS-1",
      anchors_json: [
        { type: "ticket", id: ticket.id, label: ticket.shorthand, metadata: { shorthand: ticket.shorthand } },
      ],
      branch: "feature/work",
      worktree_path: "/tmp/ws-1",
    };
    const unrelated = {
      id: "ws-2",
      workspace_shorthand: "WS-2",
      anchors_json: [
        {
          type: "ticket",
          id: "other-ticket",
          label: "PS-999",
          metadata: {
            shorthand: "PS-999",
            resourceParent: { type: "view", viewId: "pstdio.pstdio-planner.view.tickets" },
          },
        },
      ],
    };

    const sections = await listTicketFilesTreeCommand.run(
      ...makeCommandArgs({
        storage,
        params: ticketRendererParams(ticket),
        overrides: { workspaces: { list: async () => [linked, unrelated] } },
      }),
    );

    expect(sections.map((section) => section.id)).toEqual(["ticket", "files", "workspaces", "sessions"]);
    expect(sections[2]).toMatchObject({
      id: "workspaces",
      label: "Workspaces",
      collapsible: true,
      actions: [
        {
          id: "create-workspace",
          label: "Create workspace",
          icon: "Plus",
          command: createWorkspaceCommand.ref,
          params: { ticket: ticket.id },
          input: createWorkspaceTreeActionParams,
        },
      ],
      nodes: [
        {
          id: "workspace-ws-1",
          label: "WS-1",
          icon: "GitBranch",
          target: {
            kind: "page",
            page: workbenchPages.workspace,
            parent: {
              kind: "page",
              page: { kind: "page", id: "ticket", extensionId: "pstdio.pstdio-planner" },
              resource: {
                type: "ticket",
                id: ticket.id,
                label: `${ticket.shorthand} ${ticket.title}`,
                metadata: {
                  shorthand: ticket.shorthand,
                  resourceParent: { type: "view", viewId: "pstdio.pstdio-planner.view.tickets" },
                },
              },
              parent: { kind: "page", page: { kind: "page", id: "tickets", extensionId: "pstdio.pstdio-planner" } },
            },
            resource: {
              type: "workspace",
              id: "ws-1",
              label: "WS-1",
              metadata: {
                resourceParent: {
                  type: "ticket",
                  id: ticket.id,
                  label: `${ticket.shorthand} ${ticket.title}`,
                  metadata: {
                    shorthand: ticket.shorthand,
                    resourceParent: { type: "view", viewId: "pstdio.pstdio-planner.view.tickets" },
                  },
                },
                workspaceId: "ws-1",
                workspaceShorthand: "WS-1",
                workspaceType: "worktree",
              },
            },
          },
        },
      ],
    });
  });

  test("sorts linked workspaces by latest workspace activity before shorthand", async () => {
    const storage = createMemoryStorage();
    const ticket = await createTicketCommand.run(...makeCommandArgs({ storage, params: { title: "Ticket" } }));

    const sections = await listTicketFilesTreeCommand.run(
      ...makeCommandArgs({
        storage,
        params: ticketRendererParams(ticket),
        overrides: {
          workspaces: {
            list: async () => [
              {
                id: "ws-old",
                workspace_shorthand: "WS-1",
                anchors_json: [
                  { type: "ticket", id: ticket.id, label: ticket.shorthand, metadata: { shorthand: ticket.shorthand } },
                ],
                updated_at: "2026-01-01T00:00:00.000Z",
              },
              {
                id: "ws-new",
                workspace_shorthand: "WS-2",
                anchors_json: [
                  { type: "ticket", id: ticket.id, label: ticket.shorthand, metadata: { shorthand: ticket.shorthand } },
                ],
                updated_at: "2026-01-02T00:00:00.000Z",
              },
            ],
          },
        },
      }),
    );

    expect(sections[2]?.nodes.map((node) => node.id)).toEqual(["workspace-ws-new", "workspace-ws-old"]);
  });

  test("keeps the Workspaces section action and empty row when no workspace is linked to the ticket", async () => {
    const storage = createMemoryStorage();
    const ticket = await createTicketCommand.run(...makeCommandArgs({ storage, params: { title: "Ticket" } }));

    const sections = await listTicketFilesTreeCommand.run(
      ...makeCommandArgs({
        storage,
        params: ticketRendererParams(ticket),
        overrides: {
          workspaces: {
            list: async () => [
              {
                id: "ws-2",
                anchors_json: [
                  {
                    type: "ticket",
                    id: "PS-999",
                    label: "PS-999",
                    metadata: {
                      shorthand: "PS-999",
                      resourceParent: { type: "view", viewId: "pstdio.pstdio-planner.view.tickets" },
                    },
                  },
                ],
              },
            ],
          },
        },
      }),
    );

    expect(sections.map((section) => section.id)).toEqual(["ticket", "files", "workspaces", "sessions"]);
    expect(sections[2]).toMatchObject({
      id: "workspaces",
      label: "Workspaces",
      collapsible: true,
      actions: [
        {
          id: "create-workspace",
          label: "Create workspace",
          icon: "Plus",
          command: createWorkspaceCommand.ref,
          params: { ticket: ticket.id },
          input: createWorkspaceTreeActionParams,
        },
      ],
      nodes: [
        {
          id: "workspaces-empty",
          label: "No workspaces",
          icon: "GitBranch",
          disabled: true,
          rowVariant: "empty-state",
        },
      ],
    });
    expect(sections[2]).not.toHaveProperty("canHide");
    expect(sections[2]).not.toHaveProperty("emptyState");
  });
});
