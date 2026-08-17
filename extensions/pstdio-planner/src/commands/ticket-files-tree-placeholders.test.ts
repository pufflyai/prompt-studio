import { describe, expect, test } from "bun:test";
import { createMemoryStorage } from "../data/memory-storage";
import { makeCommandContext } from "./command-context.fixture";
import { createTicketCommand } from "./create-ticket";
import { listTicketFilesTreeCommand } from "./ticket-files";

const treeParams = (ticket: { id: string; shorthand: string }) => ({
  renderer: {
    rendererId: "pstdio-planner.ticketFiles",
    resource: { type: "ticket", id: ticket.id, label: ticket.shorthand },
  },
});

describe("ticket files tree empty sections", () => {
  test("renders single disabled rows for empty files, workspaces, and sessions sections", async () => {
    const storage = createMemoryStorage();
    const ticket = await createTicketCommand.run(makeCommandContext({ storage, params: { title: "Ticket" } }));

    const sections = await listTicketFilesTreeCommand.run(
      makeCommandContext({
        storage,
        params: treeParams(ticket),
        overrides: { workspaces: { list: async () => [] } },
      }),
    );

    const filesSection = sections.find((section) => section.id === "files");
    const workspacesSection = sections.find((section) => section.id === "workspaces");
    const sessionsSection = sections.find((section) => section.id === "sessions");

    expect(filesSection).toMatchObject({
      collapsible: true,
      nodes: [{ id: "files-empty", label: "No files", icon: "FileText", disabled: true, rowVariant: "empty-state" }],
    });
    expect(filesSection).not.toHaveProperty("emptyState");
    expect(workspacesSection).toMatchObject({
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
    expect(workspacesSection).not.toHaveProperty("emptyState");
    expect(sessionsSection).toMatchObject({
      nodes: [
        {
          id: "sessions-empty",
          label: "No sessions",
          icon: "MessageCircle",
          disabled: true,
          rowVariant: "empty-state",
        },
      ],
    });
    expect(sessionsSection).not.toHaveProperty("emptyState");
  });
});

describe("ticket files tree workspace metadata", () => {
  test("adds workspace metadata to ticket-linked workspace resource nodes", async () => {
    const storage = createMemoryStorage();
    const parent = await createTicketCommand.run(makeCommandContext({ storage, params: { title: "Parent" } }));
    const ticket = await createTicketCommand.run(
      makeCommandContext({ storage, params: { title: "Child", parentId: parent.id } }),
    );

    const sections = await listTicketFilesTreeCommand.run(
      makeCommandContext({
        storage,
        params: treeParams(ticket),
        overrides: {
          workspaces: {
            list: async () => [
              {
                id: "ws-1",
                workspace_shorthand: "WS-1",
                anchors_json: [
                  { type: "ticket", id: ticket.id, label: ticket.shorthand, metadata: { shorthand: ticket.shorthand } },
                ],
                worktree_path: "/tmp/ws-1",
              },
            ],
          },
        },
      }),
    );

    expect(sections.find((section) => section.id === "workspaces")?.nodes[0]).toMatchObject({
      target: {
        kind: "resource",
        resource: {
          metadata: {
            workspaceId: "ws-1",
            workspaceShorthand: "WS-1",
            workspaceType: "worktree",
            resourceParent: {
              type: "ticket",
              id: ticket.id,
              label: `${ticket.shorthand} Child`,
              metadata: {
                shorthand: ticket.shorthand,
                resourceParent: {
                  type: "ticket",
                  id: parent.id,
                  label: `${parent.shorthand} Parent`,
                  metadata: { shorthand: parent.shorthand },
                },
              },
            },
          },
        },
      },
    });
  });
});
