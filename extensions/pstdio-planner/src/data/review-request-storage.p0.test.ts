import { expect, test } from "bun:test";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { readReviewRequest, reviewOutcomesCollection, reviewRequestsCollection } from "./review-request-storage";
import type { ReviewRequest } from "./review-request-types";

test("saved answers follow question order even when questions were answered out of order", async () => {
  const storage = createMemoryStorage();
  const request: ReviewRequest = {
    id: "review-1",
    ticketId: "ticket-1",
    title: "Choose the scope",
    instructions: "Answer each question.",
    requestedAt: "2026-10-15T10:00:00Z",
    requestedBy: { type: "agent", id: "agent-1", displayName: "Agent" },
    context: { reason: null, workspaceId: null, attemptRevision: null, sessionId: "session-1", relatedSessionId: null },
    request: {
      kind: "decision",
      questions: [
        { id: "scope", label: "Scope", required: true, input: { kind: "text" } },
        { id: "optional", label: "Optional note", required: false, input: { kind: "text" } },
        { id: "notes", label: "Notes", required: false, input: { kind: "text" } },
      ],
    },
  };
  await reviewRequestsCollection(storage).put(request.id, request);
  await reviewOutcomesCollection(storage).put(request.id, {
    requestId: request.id,
    kind: "answered",
    at: "2026-10-15T10:01:00Z",
    by: { type: "human", id: "person", displayName: "Person" },
    response: { answers: { notes: "Ship today", scope: "Preview" } },
  });
  expect((await readReviewRequest(storage, request.id))?.outcomeText).toBe("Scope: Preview\nNotes: Ship today");
});
