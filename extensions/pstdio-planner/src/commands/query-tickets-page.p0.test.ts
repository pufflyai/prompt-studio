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
  expect(result.rows.map((row) => row.resource.extensionId)).toEqual(["pstdio.planner", "pstdio.planner"]);
  expect(selectedFields.flat()).not.toContain("needsAttention");
  expect(selectedFields.flat()).not.toContain("reviewRequests");
});

test("Board does not resolve hidden relationship badges or query reviews for an empty page", async () => {
  const storage = createMemoryStorage();
  const ctx = makeCommandContext({ storage, params: {} });
  await putTicket(storage, {
    id: "visible",
    shorthand: "T-1",
    title: "Visible",
    content: "# Visible",
    statusId: "ready",
    archived: false,
    position: "a",
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
  });
  ctx.resources.queryRelated = async () => {
    throw new Error("Hidden links must not be resolved");
  };
  const aggregate = storage.records.aggregate;
  storage.records.aggregate = async (query) => {
    if (query.index === "review-request-state") throw new Error("Unrequested reviews must not be counted");
    return aggregate(query);
  };
  const input = {
    page: { limit: 100, offset: 0, fields: ["id", "priority"], search: "" },
    settings: {
      viewMode: "board",
      columnGrouping: "status",
      rowGrouping: "none",
      displayProperties: ["id", "priority"],
    },
  } as const;
  const visible = await queryTickets(ctx, input as never);
  expect(visible.rows.map(({ id }) => id)).toEqual(["visible"]);
  const empty = await queryTickets(ctx, {
    ...input,
    page: { ...input.page, fields: ["reviewRequests"] },
    filter: { conjunction: "and", rules: [{ attributeId: "status", condition: "is-any-of", value: ["done"] }] },
  } as never);
  expect(empty.rows).toEqual([]);
  expect(empty.page.total).toBe(0);
});

test.each([
  "created",
  "updated",
])("Board preserves viewer-zone ordering for historical date-only %s metadata", async (attributeId) => {
  const storage = createMemoryStorage();
  for (const [id, date] of [
    ["calendar", "2026-01-01"],
    ["instant", "2026-01-01T03:00:00.000Z"],
  ]) {
    await putTicket(storage, {
      id,
      shorthand: `T-${id}`,
      title: id,
      content: `# ${id}`,
      statusId: "ready",
      archived: false,
      position: id,
      createdAt: date,
      updatedAt: date,
    });
  }
  const ctx = makeCommandContext({ storage, params: {} });
  const result = await queryTickets(ctx, {
    sorts: [{ attributeId, direction: "asc" }],
    page: {
      limit: 100,
      offset: 0,
      fields: ["id"],
      search: "",
      viewer: { locale: "en-US", timeZone: "America/New_York", now: "2026-01-01T00:00:00.000Z" },
    },
    settings: { viewMode: "list", columnGrouping: "none", rowGrouping: "none", displayProperties: ["id"] },
  } as never);
  expect(result.rows.map(({ id }) => id)).toEqual(["instant", "calendar"]);
});
