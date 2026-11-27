import { expect, test } from "bun:test";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { readReviewCounts } from "./review-query-counts";
import { ticketHasPendingReview } from "./review-query-indexes";
import { preparePlannerIndexes } from "./storage-indexes";

test("review attention uses canonical outcome keys and validates responses before paging", async () => {
  const storage = createMemoryStorage();
  const actor = { type: "human", id: "person", displayName: "Person" };
  const request = (id: string, ticketId: string) => ({
    id,
    ticketId,
    title: "Review",
    instructions: "Choose",
    requestedAt: "now",
    requestedBy: actor,
    context: { reason: null, workspaceId: null, sessionId: null, relatedSessionId: null, attemptRevision: null },
    request: {
      kind: "decision",
      questions: [
        {
          id: "question",
          label: "Question",
          required: true,
          input: { kind: "single-choice", options: [{ id: "yes", label: "Yes" }] },
        },
      ],
    },
  });
  const requests = storage.collection("planner-review-requests");
  const outcomes = storage.collection("planner-review-request-outcomes");
  for (let i = 0; i < 12; i++) {
    await storage.collection("tickets").put(`ticket-${i}`, { id: `ticket-${i}` });
    await requests.put(`request-${i}`, request(`request-${i}`, `ticket-${i}`));
    await outcomes.put(`request-${i}`, {
      requestId: "untrusted copied field",
      kind: "answered",
      at: "now",
      by: actor,
      response: { answers: { question: i === 9 ? "invalid" : "yes" } },
    });
  }
  await preparePlannerIndexes(storage);
  storage.records.list = async () => {
    throw new Error("Full collection read");
  };
  const page = await storage.records.query({
    index: "ticket-records",
    where: ticketHasPendingReview,
    fields: ["id"],
    limit: 1,
  });
  expect(page.records.map((record) => record.fields.id)).toEqual(["ticket-9"]);
  expect(page.cursor).toBeNull();
  expect((await storage.records.aggregate({ index: "ticket-records", where: ticketHasPendingReview })).count).toBe(1);
  const ids = Array.from({ length: 102 }, (_, i) => `ticket-${i}`);
  const counts = await readReviewCounts(storage, ids);
  expect(counts.get("ticket-0")).toEqual({ total: 1, pending: 0, answered: 1 });
  expect(counts.get("ticket-9")).toEqual({ total: 1, pending: 1, answered: 0 });
  expect(counts.get("ticket-101")).toEqual({ total: 0, pending: 0, answered: 0 });
  await outcomes.put("request-9", { kind: "cancelled", reason: "No longer needed", at: "now", by: actor });
  expect((await storage.records.aggregate({ index: "ticket-records", where: ticketHasPendingReview })).count).toBe(0);
  expect((await readReviewCounts(storage, ids)).get("ticket-9")).toEqual({ total: 1, pending: 0, answered: 0 });
});
