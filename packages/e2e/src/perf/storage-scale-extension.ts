import { defineCommand, defineExtension, type ExtensionStorageApi, params } from "@pstdio/sdk/extensions";
import {
  type FixtureRow,
  matches,
  type Selection,
  scaleScopePredicate,
  scaleSelectionPredicate,
  scaleStorageIndexes,
  scaleViewFields,
} from "storage-scale-fixture";

import { consistentRead } from "./storage-scale-consistent-read";

export { createScaleViews } from "./storage-scale-views";

interface Input {
  action: "seed" | "read" | "record" | "page" | "aggregate" | "commit" | "outcome" | "stats";
  planner?: boolean;
  rows?: FixtureRow[];
  deleted?: string[];
  operationId?: string;
  id?: string;
  selection?: Selection;
  page?: number;
  count?: number;
  restore?: boolean;
}

export const plannerValue = (row: FixtureRow, count: number) => ({
  ...row,
  shorthand: `PS-${row.ordinal + 1}`,
  content: "content" in row ? row.content : "",
  statusId: matches(row, "focus", count) ? "ready" : "backlog",
  tagIds: row.tags,
  attachments: [],
  parentId: null,
  dependsOn: [],
  blockedReason: null,
  userPrompt: null,
  draft: false,
  archived: false,
  sortOrder: row.rank,
});

// At most 100 tickets per lookup, the public query limit; the identity index finds each by ID.
const plannerAddresses = async (storage: ExtensionStorageApi, ids: string[]) => {
  const addresses = new Map<string, { recordId: string; wrapper: Record<string, unknown> }>();
  for (let start = 0; start < ids.length; start += 100) {
    const found = await storage.records.query({
      index: "scale-identities",
      where: { field: "id", op: "in", value: ids.slice(start, start + 100) },
      fields: ["id"],
      limit: 100,
    });
    const records = await storage.records.readMany(found.records.map((record) => record.recordId));
    for (const [index, record] of records.entries())
      addresses.set(String(found.records[index].fields.id), {
        recordId: record.recordId,
        wrapper: record.value as Record<string, unknown>,
      });
  }
  return addresses;
};

const saveRows = async (storage: ExtensionStorageApi, input: Input) => {
  if (input.planner) {
    // Use the same public collection as Planner. No database or owner impersonation.
    const tickets = storage.collection("tickets");
    if (input.action === "commit" || (input.rows ?? []).some((row) => row.history > 0) || input.deleted?.length) {
      // Discover opaque addresses through the public indexed API and keep them unchanged.
      // Creation uses the collection API; later fixture edits can use ordinary grouped commits.
      const addresses = await plannerAddresses(storage, [
        ...(input.rows ?? []).map((row) => row.id),
        ...(input.deleted ?? []),
      ]);
      const existing = (id: string) => {
        const record = addresses.get(id);
        if (!record) throw new Error(`Planner seed record missing: ${id}`);
        return record;
      };
      return storage.records.commit({
        operationId: input.operationId!,
        edits: [
          ...(input.rows ?? []).map((row) => ({
            recordId: existing(row.id).recordId,
            replace: { ...existing(row.id).wrapper, value: plannerValue(row, input.count!) },
          })),
          ...(input.deleted ?? []).map((id) => ({ recordId: existing(id).recordId, deleted: true })),
        ],
      });
    }
    for (const row of input.rows ?? []) await tickets.put(row.id, plannerValue(row, input.count!));
    for (const id of input.deleted ?? []) await tickets.delete(id);
    return { status: "saved-locally", atomic: false };
  }
  return storage.records.commit({
    operationId: input.operationId!,
    edits: [
      ...(input.rows ?? []).map((row) => ({
        recordId: storage.records.id(row.id),
        replace: row,
        ...(input.restore && { deleted: false }),
      })),
      ...(input.deleted ?? []).map((id) => ({ recordId: storage.records.id(id), deleted: true })),
    ],
  });
};

export const fixtureCommands = [
  defineCommand({
    id: "scale",
    title: "Run isolated scale fixture operation",
    mutating: true,
    params: { input: params.json<Input>() },
    async run(ctx, { input }) {
      if (!input) throw new Error("Missing fixture input");
      if (input.action === "seed" || input.action === "commit") {
        const start = performance.now();
        const outcome = await saveRows(ctx.storage, input);
        return { outcome, durableAckMs: performance.now() - start };
      }
      if (input.action === "outcome") return ctx.storage.records.outcome(input.operationId!);
      if (input.action === "record") return ctx.storage.records.read(ctx.storage.records.id(input.id!));
      if (input.action === "read") {
        return input.planner
          ? ctx.storage.collection("tickets").get(input.id!)
          : (await ctx.storage.records.read(ctx.storage.records.id(input.id!))).value;
      }
      if (input.action === "stats") {
        // Preparation verifies every stored row, so it alone reads whole owners.
        const all = input.planner
          ? await ctx.storage.collection<FixtureRow>("tickets").list()
          : (await ctx.storage.records.list())
              .filter((record) => !record.deleted)
              .map((record) => record.value as FixtureRow);
        const sizes = all.map((row) => Buffer.byteLength(JSON.stringify(row))).sort((a, b) => a - b);
        return {
          count: all.length,
          bytes: sizes.reduce((sum, bytes) => sum + bytes, 0),
          minBytes: sizes[0],
          medianBytes: sizes[Math.floor(sizes.length / 2)],
          maxBytes: sizes.at(-1),
          tail16KiB: sizes.filter((bytes) => bytes >= 16_384).length,
          fieldCount: Object.keys(all[0] ?? {}).length,
          historyCounts: all.reduce<Record<string, number>>((counts, row) => {
            const history = String(row.history);
            counts[history] = (counts[history] ?? 0) + 1;
            return counts;
          }, {}),
          shape: input.planner ? "stored-planner-ticket" : "stored-fixture-row",
        };
      }
      if (input.action === "aggregate") {
        const { attempts, value } = await consistentRead(() => countScaleRows(ctx.storage, input));
        return { ...value, readAttempts: attempts };
      }
      return queryScalePage(ctx.storage, input);
    },
  }),
];

const scaleIndex = "scale-rows";

const selectionWhere = (input: Input) =>
  scaleScopePredicate(input.planner ?? false, scaleSelectionPredicate(input.count!, input.selection ?? "focus"));

// The selection's count and the owner's total, from one committed revision.
const countScaleRows = async (storage: ExtensionStorageApi, input: Input) => {
  const matching = await storage.records.aggregate({ index: scaleIndex, where: selectionWhere(input) });
  // Owners hold only rows, so their stored count answers the total; Planner also stores statuses.
  const total = await storage.records.aggregate(
    input.planner ? { index: scaleIndex, where: scaleScopePredicate(true) } : { index: scaleIndex },
  );
  // Extension APIs expose no database counters; the database layer diagnostic measures them.
  return {
    revision: total.revision,
    consistent: matching.revision === total.revision,
    selected: matching.count,
    total: total.count,
    scanned: null,
  };
};

// One bounded indexed page plus the counts a collection view shows with it.
const queryScalePage = async (storage: ExtensionStorageApi, input: Input) => {
  const start = performance.now();
  const { attempts, value } = await consistentRead(async () => {
    const page = await storage.records.query({
      index: scaleIndex,
      where: selectionWhere(input),
      fields: scaleViewFields,
      limit: 100,
      offset: (input.page ?? 0) * 100,
    });
    const counts = await countScaleRows(storage, input);
    return { page, counts, consistent: counts.consistent && counts.revision === page.revision };
  });
  const { page, counts } = value;
  return {
    capability: "indexed-query",
    readAttempts: attempts,
    queryMs: performance.now() - start,
    scanned: counts.scanned,
    consumerScanned: 0,
    materialized: page.records.length,
    total: counts.total,
    matching: counts.selected,
    rows: page.records.map(
      (record) => record.fields as Pick<FixtureRow, "id" | "title" | "rank" | "owner" | "ordinal">,
    ),
  };
};

export const ownerStorageIndexes = scaleStorageIndexes();
export const plannerStorageIndexes = scaleStorageIndexes(true);

export default defineExtension({ storageIndexes: ownerStorageIndexes, commands: fixtureCommands });
