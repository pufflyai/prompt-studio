import { describe, expect, test } from "bun:test";
import { inputRequestsCollection } from "../data/attempt-storage";
import { createMemoryStorage } from "../data/memory-storage";
import { makeCommandContext } from "./command-context.fixture";
import { createTicketCommand } from "./create-ticket";
import { listTicketFilesTreeCommand } from "./ticket-files";

const ticketRendererParams = (ticket: { id: string; shorthand: string }) => ({
  renderer: {
    rendererId: "pstdio-planner.ticketFiles",
    resource: {
      type: "ticket",
      id: ticket.id,
      label: ticket.shorthand,
    },
  },
});

describe("ticket input request tree commands", () => {
  test("shows open input requests before sessions with navigation and resolution actions", async () => {
    const storage = createMemoryStorage();
    const ticket = await createTicketCommand.run(makeCommandContext({ storage, params: { title: "Ticket" } }));
    await inputRequestsCollection(storage).put("request-1", {
      id: "request-1",
      ticketId: ticket.id,
      workspaceId: null,
      revision: null,
      sessionId: "session-1",
      relatedSessionId: "refinement-1",
      reason: "refinement-ready",
      question: "Read the refined ticket.",
      expectedAction: "Resolve the request after reading it.",
      state: "open",
      requestedAt: "2026-08-20T00:00:00.000Z",
      resolvedAt: null,
      resolvedBy: null,
      resolution: null,
    });
    await inputRequestsCollection(storage).put("request-2", {
      id: "request-2",
      ticketId: ticket.id,
      workspaceId: null,
      revision: null,
      sessionId: "session-2",
      relatedSessionId: null,
      reason: "dependency-cycle",
      question: "Already resolved",
      expectedAction: "Nothing",
      state: "resolved",
      requestedAt: "2026-08-19T00:00:00.000Z",
      resolvedAt: "2026-08-20T00:00:00.000Z",
      resolvedBy: { type: "human", id: "user-1", displayName: "User" },
      resolution: "Done",
    });

    const sections = await listTicketFilesTreeCommand.run(
      makeCommandContext({ storage, params: ticketRendererParams(ticket) }),
    );
    const inputRequests = sections.find((section) => section.id === "input-requests");

    expect(sections.findIndex((section) => section.id === "input-requests")).toBe(
      sections.findIndex((section) => section.id === "sessions") - 1,
    );
    expect(inputRequests).toEqual({
      id: "input-requests",
      label: "Input requests",
      collapsible: true,
      nodes: [
        {
          id: "input-request-request-1",
          label: "Read the refined ticket.",
          description: "Resolve the request after reading it.",
          icon: "Bell",
          iconColor: "orange.fg",
          target: {
            kind: "resource",
            resource: {
              type: "session",
              id: "session-1",
              projectId: "proj-1",
              label: "Read the refined ticket.",
              metadata: { sessionSurface: "side" },
            },
          },
          actions: [
            {
              id: "resolve-input-request",
              label: "Resolve input request",
              icon: "Check",
              command: "pstdio-planner.resolve-input-request",
              params: { requestId: "request-1" },
              submitLabel: "Resolve",
              input: {
                resolution: { type: "longtext", label: "Resolution", required: true },
                completedAction: { type: "longtext", label: "Completed action", required: true },
              },
            },
          ],
        },
      ],
    });
  });
});
