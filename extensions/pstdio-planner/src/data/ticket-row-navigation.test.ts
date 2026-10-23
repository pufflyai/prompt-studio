import { expect, test } from "bun:test";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { makeCommandArgs } from "../commands/command-context.fixture";
import { createTicketCommand } from "../commands/create-ticket";
import { runTicketsQuery } from "./query";
import { reviewRequestsCollection } from "./review-request-storage";

test("ticket rows include their destination using the already-loaded review state", async () => {
  const storage = createMemoryStorage();
  const ticket = await createTicketCommand.run(...makeCommandArgs({ storage, params: { title: "Navigation" } }));
  const query = () => runTicketsQuery({ storage, projectId: "project-1" });
  expect((await query()).rows[0]?.target).toMatchObject({
    kind: "page",
    page: { id: "ticket" },
    resource: { id: ticket.id },
  });
  await reviewRequestsCollection(storage).put("review", {
    id: "review",
    ticketId: ticket.id,
    title: "Review",
    instructions: "Review the work",
    request: { kind: "task" },
    requestedAt: "2026-10-20T00:00:00Z",
    requestedBy: { type: "human", id: "user", displayName: "User" },
    context: { reason: null, workspaceId: null, attemptRevision: null, sessionId: "session", relatedSessionId: null },
  });
  expect((await query()).rows[0]?.target).toMatchObject({
    kind: "page",
    page: { id: "ticket-requests" },
    resource: { id: ticket.id },
    parent: { kind: "page", page: { id: "ticket" } },
  });
});
