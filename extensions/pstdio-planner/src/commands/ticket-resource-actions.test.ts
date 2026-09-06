import { expect, test } from "bun:test";
import { createMemoryStorage } from "../data/memory-storage";
import { makeCommandArgs } from "./command-context.fixture";
import { createTicketCommand } from "./create-ticket";
import { createTicketFileCommand, listTicketFilesTreeCommand } from "./ticket-files";

test("ticket tree rows identify their action resource independently of file navigation", async () => {
  const storage = createMemoryStorage();
  const ticket = await createTicketCommand.run(...makeCommandArgs({ storage, params: { title: "Parent" } }));
  const child = await createTicketCommand.run(
    ...makeCommandArgs({ storage, params: { title: "Child", parentId: ticket.id } }),
  );
  const file = await createTicketFileCommand.run(
    ...makeCommandArgs({ storage, params: { ticketId: ticket.id, name: "notes.md" } }),
  );
  const sections = await listTicketFilesTreeCommand.run(
    ...makeCommandArgs({
      storage,
      params: {
        renderer: {
          rendererId: "pstdio.pstdio-planner.view.ticket-files",
          resource: { type: "ticket", id: ticket.id, metadata: { documentId: file.id } },
        },
      },
      overrides: {
        workspaces: {
          list: async () => [
            {
              id: "linked-workspace",
              workspace_shorthand: "WS-1",
              name: "Ticket workspace",
              anchors_json: [{ type: "ticket", id: ticket.id, metadata: { shorthand: ticket.shorthand } }],
            },
          ],
        },
      },
    }),
  );

  const ticketNode = sections.find((section) => section.id === "ticket")!.nodes[0];
  const childNode = sections.find((section) => section.id === "sub-tickets")!.nodes[0];
  const workspaceNode = sections.find((section) => section.id === "workspaces")!.nodes[0];
  const fileNode = sections.find((section) => section.id === "files")!.nodes[0];

  expect(ticketNode.resource).toMatchObject({ type: "ticket", id: ticket.id });
  expect(childNode.resource).toMatchObject({ type: "ticket", id: child.id });
  expect(workspaceNode.resource).toMatchObject({ type: "workspace", id: "linked-workspace" });
  expect(childNode.target).toMatchObject({ resource: childNode.resource });
  expect(workspaceNode.target).toMatchObject({ resource: workspaceNode.resource });
  expect(fileNode).toMatchObject({
    selected: true,
    target: { resource: { type: "ticket", id: ticket.id, metadata: { documentId: file.id } } },
    contextMenuActions: [
      { id: "rename", params: { ticketId: ticket.id, fileId: file.id } },
      { id: "delete", params: { ticketId: ticket.id, fileId: file.id } },
    ],
  });
  expect(fileNode.resource).toBeUndefined();
});
