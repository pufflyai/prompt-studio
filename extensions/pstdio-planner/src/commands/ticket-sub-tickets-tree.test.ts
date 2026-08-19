import { describe, expect, test } from "bun:test";
import { createMemoryStorage } from "../data/memory-storage";
import { makeCommandContext } from "./command-context.fixture";
import { createTicketCommand } from "./create-ticket";
import { listTicketFilesTreeCommand } from "./ticket-files";

describe("ticket files tree sub-ticket section", () => {
  test("lists child tickets as sub-tickets in the ticket resource tree", async () => {
    const storage = createMemoryStorage();
    const parent = await createTicketCommand.run(makeCommandContext({ storage, params: { title: "Parent" } }));
    const child = await createTicketCommand.run(
      makeCommandContext({ storage, params: { title: "Child", parentId: parent.id } }),
    );
    await createTicketCommand.run(makeCommandContext({ storage, params: { title: "Unrelated" } }));

    const sections = await listTicketFilesTreeCommand.run(
      makeCommandContext({
        storage,
        params: {
          renderer: {
            rendererId: "pstdio-planner.ticketFiles",
            resource: { type: "ticket", id: parent.id, label: parent.shorthand },
          },
        },
      }),
    );

    expect(sections.find((section) => section.id === "sub-tickets")).toEqual({
      id: "sub-tickets",
      label: "Sub-tickets",
      collapsible: true,
      canHide: true,
      nodes: [
        {
          id: `ticket-${child.id}`,
          label: `${child.shorthand} ${child.title}`,
          icon: "Component",
          iconColor: "gray.fg",
          iconTooltip: "Backlog",
          target: {
            kind: "resource",
            resource: {
              type: "ticket",
              id: child.id,
              label: `${child.shorthand} ${child.title}`,
              metadata: {
                shorthand: child.shorthand,
                resourceParent: {
                  type: "ticket",
                  id: parent.id,
                  label: `${parent.shorthand} ${parent.title}`,
                  metadata: {
                    shorthand: parent.shorthand,
                    resourceParent: {
                      type: "extension-view",
                      id: "pstdio-planner.tickets",
                      label: "Tickets",
                      icon: "square-kanban",
                    },
                  },
                },
              },
            },
          },
        },
      ],
    });
  });
});
