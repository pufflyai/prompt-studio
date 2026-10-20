import { describe, expect, test } from "bun:test";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { reviewOutcomesCollection, reviewRequestsCollection } from "../data/review-request-storage";
import type { ReviewRequest } from "../data/review-request-types";
import { makeCommandArgs } from "./command-context.fixture";
import { createTicketCommand } from "./create-ticket";
import { listTicketFilesTreeCommand } from "./ticket-files";

const request = (id: string, ticketId: string): ReviewRequest => ({
  id,
  ticketId,
  title: "Review the proposal",
  instructions: "Check the scenarios.",
  request: { kind: "task" },
  requestedAt: "2026-10-12T09:00:00.000Z",
  requestedBy: { type: "agent", id: "agent", displayName: "Agent" },
  context: { reason: null, workspaceId: null, attemptRevision: null, sessionId: "chat", relatedSessionId: null },
});

const setup = async () => {
  const storage = createMemoryStorage();
  const ticket = await createTicketCommand.run(...makeCommandArgs({ storage, params: { title: "Ticket" } }));
  const tree = async (documentId?: string) => {
    const resource = { type: "ticket", id: ticket.id, ...(documentId ? { metadata: { documentId } } : {}) };
    const sections = await listTicketFilesTreeCommand.run(
      ...makeCommandArgs({ storage, params: { renderer: { rendererId: "ticket-files", resource } } }),
    );
    return sections[0].nodes.find((node) => node.id === "review-requests");
  };
  return { storage, ticket, tree };
};

describe("review requests in the ticket navigation", () => {
  test("a ticket with review requests lists them as an entry that opens the requests page", async () => {
    const { storage, ticket, tree } = await setup();
    await reviewRequestsCollection(storage).put("open", request("open", ticket.id));
    await reviewRequestsCollection(storage).put("answered", request("answered", ticket.id));
    await reviewOutcomesCollection(storage).put("answered", {
      requestId: "answered",
      kind: "answered",
      at: "2026-10-12T10:00:00.000Z",
      by: { type: "human", id: "person", displayName: "Person" },
      response: { confirmed: true },
    });

    const entry = await tree();

    expect(entry).toMatchObject({
      badge: { label: "1", color: "orange" },
      selected: false,
      target: {
        kind: "page",
        page: { kind: "page", id: "ticket-requests", extensionId: "pstdio.pstdio-planner" },
        resource: { type: "ticket", id: ticket.id, metadata: { documentId: "review-requests" } },
        parent: { kind: "page", page: { id: "ticket" } },
      },
    });
  });

  test("the entry is selected while the requests page is open", async () => {
    const { storage, ticket, tree } = await setup();
    await reviewRequestsCollection(storage).put("open", request("open", ticket.id));

    expect(await tree("review-requests")).toMatchObject({ selected: true });
  });

  test("a ticket without review requests has no entry", async () => {
    const { tree } = await setup();

    expect(await tree()).toBeUndefined();
  });
});
