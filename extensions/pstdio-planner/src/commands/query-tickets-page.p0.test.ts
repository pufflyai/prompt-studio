import { expect, test } from "bun:test";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { putTag } from "../data/collections";
import { putTicket } from "../data/ticket-context.fixture";
import { createDeadlineCommand } from "../timeline/commands/deadline-commands";
import { planPlacements } from "../timeline/commands/placement-store";
import { makeCommandContext } from "./command-context.fixture";
import { queryTickets } from "./query-tickets";

test("Board restarts an unpinned read when a ticket syncs and rejects a stale pinned revision", async () => {
  const storage = createMemoryStorage();
  const ctx = makeCommandContext({ storage, params: {} });
  const ticket = {
    id: "synced-ticket",
    shorthand: "T-1",
    title: "Synced ticket",
    content: "# Synced ticket",
    statusId: "ready",
    archived: false,
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
  };
  const query = storage.records.query.bind(storage.records);
  let syncPending = true;
  storage.records.query = async (input) => {
    if (syncPending && input.index === "ticket-view" && input.revision !== undefined) {
      syncPending = false;
      await putTicket(storage, ticket);
    }
    return query(input);
  };
  const page = { limit: 10, offset: 0, fields: ["title"], search: "" };
  const result = await queryTickets(ctx, { page });
  expect(result.rows.map(({ title }) => title)).toEqual(["Synced ticket"]);

  await putTicket(storage, { ...ticket, content: "# Updated ticket" });
  await expect(queryTickets(ctx, { page: { ...page, revision: result.page.revision } })).rejects.toThrow(
    "revision is stale",
  );
});

test("Board stops when its scoped storage read is cancelled", async () => {
  const storage = createMemoryStorage();
  const ctx = makeCommandContext({ storage, params: {} });
  const query = storage.records.query.bind(storage.records);
  const cancelled = new DOMException("The view closed", "AbortError");
  let pageReads = 0;
  storage.records.query = async (input) => {
    if (input.index === "ticket-view" && input.revision !== undefined) {
      pageReads++;
      throw cancelled;
    }
    return query(input);
  };

  await expect(queryTickets(ctx, {})).rejects.toBe(cancelled);
  expect(pageReads).toBe(1);
});

test("Board milestone date controls select active tickets with that date", async () => {
  const storage = createMemoryStorage();
  const ctx = makeCommandContext({ storage, params: {} });
  const deadline = (await createDeadlineCommand.run(ctx, { name: "Release", date: "2030-01-02" }))!;
  for (const archived of [false, true]) {
    const id = archived ? "archived" : "active";
    await putTicket(storage, {
      id,
      shorthand: archived ? "T-2" : "T-1",
      title: id,
      content: `# ${id}`,
      statusId: "ready",
      archived,
      createdAt: "2026-01-01",
      updatedAt: "2026-01-01",
    });
    await planPlacements(storage).put(id, { ticketId: id, deadlineId: deadline.id, position: id });
  }

  const result = await queryTickets(ctx, {
    filter: {
      conjunction: "and",
      rules: [{ attributeId: "milestoneDate", condition: "is", value: "2030-01-02" }],
    },
    sorts: [{ attributeId: "milestoneDate", direction: "asc" }],
    page: { limit: 10, offset: 0, fields: ["milestoneDate"], searchFields: ["milestoneDate"], search: "2030" },
  });

  expect(result.rows.map(({ id }) => id)).toEqual(["active"]);
});

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

test("Board filter counts include unloaded tickets and count multi-select options independently", async () => {
  const storage = createMemoryStorage();
  const ctx = makeCommandContext({ storage, params: {} });
  await putTag(storage, {
    id: "labels",
    name: "Labels",
    type: "multi_select",
    sortOrder: 0,
    options: ["defect", "urgent"].map((id, sortOrder) => ({
      id,
      name: id,
      color: "blue",
      sortOrder,
      icon: null,
      description: null,
    })),
  });
  for (const [position, title, statusId, labels] of [
    ["a", "Matching A", "ready", ["defect", "urgent"]],
    ["b", "Matching B", "ready", ["urgent"]],
    ["c", "Matching C", "backlog", ["defect"]],
    ["d", "Excluded D", "ready", ["defect", "urgent"]],
  ] as const) {
    await putTicket(storage, {
      id: position,
      shorthand: `T-${position}`,
      title,
      content: `# ${title}`,
      statusId,
      tags: { labels: [...labels] },
      archived: false,
      position,
      createdAt: "2026-01-01",
      updatedAt: "2026-01-01",
    });
  }
  const page = { limit: 1, offset: 0, fields: ["title"], searchFields: ["title"], search: "Matching" };
  const first = await queryTickets(ctx, { page });
  expect(first.rows.map(({ id }) => id)).toEqual(["a"]);
  const counts = (field: string) => {
    const statistic = first.page.statistics?.[field];
    return statistic?.type === "top-values"
      ? Object.fromEntries(statistic.values.map(({ label, count }) => [label, count]))
      : undefined;
  };
  expect(counts("status")).toEqual({ ready: 2, backlog: 1 });
  expect(counts("labels")).toEqual({ defect: 2, urgent: 2 });
  expect(counts("archived")).toEqual({ active: 3 });
  const second = await queryTickets(ctx, {
    page: { ...page, offset: 1, cursor: first.page.cursor!, revision: first.page.revision },
  });
  expect(second.rows.map(({ id }) => id)).toEqual(["b"]);
  expect(second.page.statistics).toEqual(first.page.statistics);
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
