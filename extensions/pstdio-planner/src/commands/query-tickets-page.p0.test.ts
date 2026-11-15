import { expect, test } from "bun:test";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { putTicket } from "../data/ticket-context.fixture";
import { makeCommandContext } from "./command-context.fixture";
import { queryTickets } from "./query-tickets";

test("Board selects late matching tickets and global counts without loading ticket bodies or collections", async () => {
  const storage = createMemoryStorage();
  let previous: string | undefined;
  for (let i = 0; i < 1003; i++) {
    const position = storage.positions.between(previous);
    previous = position;
    await putTicket(storage, {
      id: `ticket-${String(i).padStart(4, "0")}`,
      shorthand: `T-${i + 1}`,
      title: "Stored title",
      content: `# ${i > 999 ? "Late match" : "Background"} ${i}\n\n${"Body. ".repeat(1000)}`,
      statusId: i > 999 ? "ready" : "backlog",
      archived: false,
      position,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
  }
  const ctx = makeCommandContext({ storage, params: {} });
  const collection = storage.collection.bind(storage);
  storage.collection = <T>(name: string) => {
    const items = collection<T>(name);
    if (
      !["tickets", "planner-review-requests", "planner-review-request-outcomes", "timeline.placements"].includes(name)
    )
      return items;
    return {
      ...items,
      list: async () => {
        throw new Error(`Unbounded ${name}`);
      },
      ...(name === "tickets"
        ? {
            get: async () => {
              throw new Error("Board loaded a ticket body");
            },
          }
        : {}),
    };
  };
  storage.records.list = async () => {
    throw new Error("Unbounded records");
  };
  const query = storage.records.query.bind(storage.records);
  const selectedFields: string[][] = [];
  storage.records.query = (input) => {
    if (input.index === "ticket-view") selectedFields.push(input.fields ?? []);
    return query(input);
  };
  const result = await queryTickets(ctx, {
    filter: { conjunction: "and", rules: [{ attributeId: "title", condition: "contains", value: "Late match" }] },
    page: { limit: 2, offset: 0, fields: ["id", "status"], search: "" },
    settings: { viewMode: "board", columnGrouping: "status", rowGrouping: "none", displayProperties: ["id"] },
  } as never);
  expect(result.rows.map((row) => row.title)).toEqual(["Late match 1000", "Late match 1001"]);
  expect(result.page?.total).toBe(3);
  expect(result.page?.groups).toContainEqual({ field: "status", value: "ready", count: 3 });
  expect(result.page?.cursor).toBeString();
  expect(selectedFields.flat()).not.toContain("needsAttention");
  expect(selectedFields.flat()).not.toContain("reviewRequests");
});
