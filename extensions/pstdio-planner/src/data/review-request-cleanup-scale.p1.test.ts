import { expect, test } from "bun:test";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { deleteTicketReviewRequests } from "./review-request-storage";

test("ticket deletion removes only its requests in bounded pages, including malformed requests", async () => {
  const entries = Array.from({ length: 5000 }, (_, index) => {
    const id = `request-${String(index).padStart(4, "0")}`;
    return [id, { id, ticketId: index < 205 ? "selected" : "other" }] as const;
  });
  const storage = createMemoryStorage({
    collections: {
      "planner-review-requests": Object.fromEntries(entries),
      "planner-review-request-outcomes": Object.fromEntries(entries.map(([id]) => [id, { requestId: id }])),
    },
  });
  const collection = storage.collection.bind(storage);
  storage.collection = <T>(name: string) => ({
    ...collection<T>(name),
    list: async () => {
      throw Error("Unbounded request read");
    },
  });
  const query = storage.records.query.bind(storage.records);
  let largestPage = 0;
  storage.records.query = async (input) => {
    const page = await query(input);
    largestPage = Math.max(largestPage, page.records.length);
    return page;
  };
  await deleteTicketReviewRequests(storage, "selected");
  expect(largestPage).toBeLessThanOrEqual(100);
  expect(await collection("planner-review-requests").get("request-0204")).toBeUndefined();
  expect(await collection("planner-review-request-outcomes").get("request-0204")).toBeUndefined();
  expect(await collection("planner-review-requests").get("request-0205")).toBeDefined();
  expect(await collection("planner-review-request-outcomes").get("request-0205")).toBeDefined();
});
