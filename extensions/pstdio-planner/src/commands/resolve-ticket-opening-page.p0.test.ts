import { expect, test } from "bun:test";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { preparePlannerIndexes } from "../data/storage-indexes";
import { observeTicketRecords, ticketIdOfRecord } from "../data/storage-reads.fixture";
import { REVIEW_REQUESTS_DOCUMENT } from "../data/ticket-page-target";
import { makeCommandContext } from "./command-context.fixture";
import { createTicketCommand } from "./create-ticket";
import { getTicketContent } from "./get-ticket-content";
import { resolveTicketResourcesCommand } from "./resolve-ticket-resources";
import { updateTicketCommand } from "./update-ticket";

const fixture = async () => {
  const ctx = makeCommandContext({
    storage: createMemoryStorage(),
    params: {},
    overrides: { extensionId: "pstdio.planner" },
  });
  const parent = await createTicketCommand.run(ctx, { content: `# Parent\n\n${"Parent text. ".repeat(10000)}` });
  const child = await createTicketCommand.run(ctx, {
    content: `# Child\n\n${"Canonical child text. ".repeat(10000)}`,
    parentId: parent.id,
  });
  return { ctx, parent, child };
};

test("body and review openings retain canonical metadata without materializing ticket documents", async () => {
  const { ctx, child } = await fixture();
  const resources = [
    { type: "ticket", id: child.id },
    { type: "ticket", id: child.id, metadata: { documentId: REVIEW_REQUESTS_DOCUMENT } },
  ];
  // A missing file forces the preexisting canonical path, and contributes no output.
  const expected = await resolveTicketResourcesCommand.run(ctx, {
    resources: [...resources, { type: "ticket", id: child.id, metadata: { documentId: "missing-file" } }],
  });
  const editor = await getTicketContent(ctx, { resource: resources[0] });
  expect(editor.content).toContain("Canonical child text.");
  await preparePlannerIndexes(ctx.storage);
  const read = ctx.storage.records.read.bind(ctx.storage.records),
    readMany = ctx.storage.records.readMany.bind(ctx.storage.records);
  const forbid = (ids: string[]) => {
    if (ids.some((id) => ticketIdOfRecord(id))) throw new Error("Opening materialized a ticket body");
  };
  ctx.storage.records.read = (id, ...args) => {
    forbid([id]);
    return read(id, ...args);
  };
  ctx.storage.records.readMany = (ids) => {
    forbid(ids);
    return readMany(ids);
  };
  expect(await resolveTicketResourcesCommand.run(ctx, { resources })).toEqual(expected);
});

test("resource opening restarts once for metadata that changed while the hierarchy was loading", async () => {
  const { ctx, child } = await fixture();
  await preparePlannerIndexes(ctx.storage);
  const query = ctx.storage.records.query.bind(ctx.storage.records);
  let changed = false;
  ctx.storage.records.query = async (input) => {
    const page = await query(input);
    if (!changed && input.index === "ticket-view" && input.fields?.includes("title")) {
      changed = true;
      await updateTicketCommand.run(ctx, { id: child.id, content: "# Concurrent title" });
    }
    return page;
  };
  const [opening] = await resolveTicketResourcesCommand.run(ctx, { resources: [{ type: "ticket", id: child.id }] });
  expect(opening?.resource.label).toBe(`${child.shorthand} Concurrent title`);
});

test("body openings keep input order and query bounded metadata across more than one hundred IDs", async () => {
  const storage = createMemoryStorage();
  const ctx = makeCommandContext({ storage, params: {} });
  const ids: string[] = [];
  for (let i = 0; i < 205; i++) {
    const ticket = await createTicketCommand.run(ctx, { title: `Ticket ${i}` });
    ids.push(ticket.id);
  }
  await preparePlannerIndexes(storage);
  const observed = observeTicketRecords(storage);
  const query = observed.storage.records.query;
  const queried: string[] = [];
  observed.storage.records.query = (input) => {
    const where = input.where;
    if (where && "field" in where && where.field === "id" && where.op === "in") {
      expect(where.value.length).toBeLessThanOrEqual(100);
      queried.push(...(where.value as string[]));
    }
    expect(input.fields).not.toContain("content");
    expect(input.limit).toBeLessThanOrEqual(100);
    return query(input);
  };
  const inputIds = [...ids.toReversed(), ids[0], "missing"];
  const resolved = await resolveTicketResourcesCommand.run(
    { ...ctx, storage: observed.storage },
    { resources: inputIds.map((id) => ({ type: "ticket", id })) },
  );
  expect(resolved.map(({ resource }) => resource.id)).toEqual(inputIds.slice(0, -1));
  expect(queried.toSorted()).toEqual([...ids, "missing"].toSorted());
  expect(observed.reads).toEqual([]);
});

test("resource opening rejects repeated revision conflicts without an unbounded restart", async () => {
  const { ctx, child } = await fixture();
  await preparePlannerIndexes(ctx.storage);
  const query = ctx.storage.records.query.bind(ctx.storage.records);
  let changes = 0;
  ctx.storage.records.query = async (input) => {
    const page = await query(input);
    if (input.index === "ticket-view" && input.fields?.includes("title")) {
      changes++;
      await updateTicketCommand.run(ctx, { id: child.id, content: `# Concurrent ${changes}` });
    }
    return page;
  };
  await expect(
    resolveTicketResourcesCommand.run(ctx, { resources: [{ type: "ticket", id: child.id }] }),
  ).rejects.toThrow("Query revision is stale; restart the query");
  // Both attempts must stop at their failed hierarchy fence, rather than loop until idle.
  expect(changes).toBe(4);
});

test("body opening follows missing and arriving core identities without exposing stale numbers", async () => {
  const { ctx, child } = await fixture();
  await preparePlannerIndexes(ctx.storage);
  const identity = ctx.resources.identity;
  let available = false;
  ctx.resources.identity = async (input) => {
    if (input.id !== child.id) return identity(input);
    return available ? { id: child.id, kind: "ticket", shorthand: "PS-901", aliases: [] } : null;
  };
  const resources = [{ type: "ticket", id: child.id }];
  expect(await resolveTicketResourcesCommand.run(ctx, { resources })).toEqual([]);
  available = true;
  const [opening] = await resolveTicketResourcesCommand.run(ctx, { resources });
  expect(opening?.resource).toMatchObject({ id: child.id, shorthand: "PS-901", label: "PS-901 Child" });
});

test("resource opening propagates cancellation and non-revision failures immediately", async () => {
  for (const error of [new DOMException("Cancelled", "AbortError"), new Error("Storage unavailable")]) {
    const { ctx, child } = await fixture();
    await preparePlannerIndexes(ctx.storage);
    let calls = 0;
    ctx.storage.records.query = async () => {
      calls++;
      throw error;
    };
    await expect(
      resolveTicketResourcesCommand.run(ctx, {
        resources: [{ type: "ticket", id: child.id }],
      }),
    ).rejects.toBe(error);
    expect(calls).toBe(1);
  }
});
