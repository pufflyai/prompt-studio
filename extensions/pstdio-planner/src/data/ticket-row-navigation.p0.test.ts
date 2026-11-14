import { expect, test } from "bun:test";
import type { NavigationTarget } from "@pstdio/sdk/extensions";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { makeCommandArgs, makeCommandContext } from "../commands/command-context.fixture";
import { createTicketCommand } from "../commands/create-ticket";
import { createPlannerUi } from "../ui-contributions";
import { runTicketsQuery } from "./query";
import { reviewRequestsCollection } from "./review-request-storage";
import { ticketContext } from "./ticket-context.fixture";

test("ticket rows open their content even when a review request needs attention", async () => {
  const storage = createMemoryStorage();
  const ticket = await createTicketCommand.run(...makeCommandArgs({ storage, params: { title: "Navigation" } }));
  const query = () => runTicketsQuery({ ...ticketContext(storage), projectId: "proj-1" });
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
    page: { id: "ticket" },
    resource: { id: ticket.id },
    parent: { kind: "page", page: { id: "tickets" } },
  });
  expect((await query()).rows[0]?.attributes.reviewRequestItems).toMatchObject([
    { action: { kind: "panel" }, tooltip: "1 item needs attention" },
  ]);
});

test("ticket activation navigates synchronously while review storage is unavailable", () => {
  const storage = createMemoryStorage();
  const pendingRead = new Promise<never>(() => {});
  const collection = storage.collection.bind(storage);
  storage.collection = <T>(name: string) => ({ ...collection<T>(name), list: () => pendingRead });
  const opened: NavigationTarget[] = [];
  const ctx = makeCommandContext({
    storage,
    params: {},
    overrides: {
      navigation: {
        open: (target) => {
          opened.push(target);
        },
      },
    },
  });
  const board = createPlannerUi(import.meta.url).views.find((view) => view.id === "tickets");
  if (board?.body.kind !== "kanban") throw new Error("Tickets board missing");
  const resource = { type: "ticket", id: "ticket-1" };
  board.body.onRowActivate?.(ctx, {
    renderer: { rendererId: "tickets" },
    row: { id: resource.id, title: "Ticket", resource, attributes: {} },
  });
  expect(opened).toMatchObject([{ kind: "page", page: { id: "ticket" }, resource }]);
});
