import { expect, test } from "bun:test";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { putStatus, putTag } from "../data/collections";
import { ticketIdOfRecord } from "../data/storage-reads.fixture";
import { putTicket } from "../data/ticket-context.fixture";
import { makeCommandContext } from "./command-context.fixture";
import { queryTickets } from "./query-tickets";

test("Board fields admit a fresh project without unbounded collection reads", async () => {
  const storage = createMemoryStorage();
  const collection = storage.collection.bind(storage);
  storage.collection = <T>(name: string) => ({
    ...collection<T>(name),
    list: async () => {
      throw new Error(`Unbounded ${name}`);
    },
  });
  storage.records.list = async () => {
    throw new Error("Unbounded records");
  };
  const result = await queryTickets(makeCommandContext({ storage, params: {} }), { fieldsOnly: true });
  expect(result.rows).toEqual([]);
  expect(result.attributes.some(({ id }) => id === "status")).toBe(true);
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
  const read = storage.records.read.bind(storage.records);
  const readMany = storage.records.readMany.bind(storage.records);
  const forbidBodies = (ids: string[]) => {
    if (ids.some((id) => ticketIdOfRecord(id))) throw new Error("Board read a canonical ticket body");
  };
  storage.records.read = (id, ...rest) => {
    forbidBodies([id]);
    return read(id, ...rest);
  };
  storage.records.readMany = (ids) => {
    forbidBodies(ids);
    return readMany(ids);
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

test("Board reads preserve subsequent edits to existing milestones", async () => {
  const storage = createMemoryStorage();
  const ctx = makeCommandContext({ storage, params: {} });
  const { createDeadlineCommand, updateDeadlineCommand } = await import("../timeline/commands/deadline-commands");
  const deadline = (await createDeadlineCommand.run(ctx, { name: "Release", date: "2030-01-02" }))!;
  await queryTickets(ctx, {});
  const edited = await updateDeadlineCommand.run(ctx, { deadline: deadline.id, date: "2030-01-03" });
  expect(edited?.id).toBe(deadline.id);
  expect(edited?.date).toBe("2030-01-03");
});

test("Board keeps every global count across 600 legal column and row groups", async () => {
  const storage = createMemoryStorage();
  const options = Array.from({ length: 20 }, (_, index) => ({
    id: `row-${index}`,
    name: `Row ${index}`,
    sortOrder: index,
    color: "gray",
    icon: null,
    description: null,
  }));
  await putTag(storage, { id: "rows", name: "Rows", type: "single_select", sortOrder: 0, options });
  let previous: string | undefined;
  for (let column = 0; column < 30; column++) {
    const statusId = `column-${column}`;
    await putStatus(storage, {
      id: statusId,
      name: statusId,
      sortOrder: column,
      color: "gray",
      isDefault: column === 0,
      canCreate: true,
      columnActions: [],
    });
    for (let row = 0; row < 20; row++) {
      const position = storage.positions.between(previous);
      previous = position;
      await putTicket(storage, {
        id: `ticket-${column}-${row}`,
        shorthand: `T-${column * 20 + row + 1}`,
        title: "Grouped",
        content: "# Grouped",
        position,
        statusId,
        tags: { rows: [`row-${row}`] },
        archived: false,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      });
    }
  }
  const ctx = makeCommandContext({ storage, params: {} });
  const result = await queryTickets(ctx, {
    page: { limit: 2, offset: 0, fields: ["id", "status", "rows"], search: "" },
    settings: { viewMode: "board", columnGrouping: "status", rowGrouping: "rows", displayProperties: ["id"] },
  } as never);
  expect(result.rows).toHaveLength(2);
  expect(result.page?.total).toBe(600);
  expect(result.page?.groups.filter(({ field }) => field === "status")).toHaveLength(30);
  expect(result.page?.groups.filter(({ field }) => field === "rows")).toHaveLength(600);
  expect(result.page?.groups.find(({ field, value }) => field === "status" && value === "column-29")?.count).toBe(20);
});

test("removed milestones do not enter active milestone counts", async () => {
  const storage = createMemoryStorage();
  const { writeStoredPlan } = await import("../timeline/commands/plan-store");
  const { writePlanMetadata } = await import("../timeline/commands/placement-store");
  const deadlines = Array.from({ length: 501 }, (_, i) => ({ id: `deadline-${i}`, date: "2030-01-01" }));
  let previous: string | undefined;
  for (let i = 0; i < deadlines.length; i++) {
    const position = storage.positions.between(previous);
    previous = position;
    await putTicket(storage, {
      id: `ticket-${i}`,
      shorthand: `T-${i + 1}`,
      title: "Planned",
      content: "# Planned",
      position,
      statusId: "ready",
      archived: false,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
  }
  await writeStoredPlan(storage, {
    deadlines,
    order: deadlines.map(({ id }, i) => ({ ticketId: `ticket-${i}`, deadlineId: id })),
  });
  await writePlanMetadata(storage, { deadlines: [deadlines[0]] });
  const ctx = makeCommandContext({ storage, params: {} });
  const result = await queryTickets(ctx, { page: { limit: 100, offset: 0, fields: ["id", "milestone"], search: "" } });
  expect(result.page?.total).toBe(501);
  expect(result.rows.find(({ id }) => id === "ticket-0")?.attributes.milestone).toBe("deadline-0");
  expect(result.rows.find(({ id }) => id === "ticket-1")?.attributes.milestone).toBe("");
});
