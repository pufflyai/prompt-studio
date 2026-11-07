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

const saveRows = async (storage: ExtensionStorageApi, input: Input) => {
  if (input.planner) {
    // Use the same public collection as Planner. No database or owner impersonation.
    const tickets = storage.collection("tickets");
    if (input.action === "commit" || (input.rows ?? []).some((row) => row.history > 0) || input.deleted?.length) {
      // Discover opaque addresses through the public API and keep them unchanged. Creation
      // uses the collection API; later fixture edits can use ordinary grouped commits.
      const addresses = new Map(
        (await storage.records.list()).flatMap((record) => {
          const wrapper = record.value;
          if (!wrapper || typeof wrapper !== "object" || Array.isArray(wrapper)) return [];
          const value = wrapper.value;
          if (
            !value ||
            typeof value !== "object" ||
            Array.isArray(value) ||
            typeof value.id !== "string" ||
            typeof value.shorthand !== "string"
          )
            return [];
          return [[value.id, { recordId: record.recordId, wrapper }] as const];
        }),
      );
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
      if (input.action === "aggregate") return countScaleRows(ctx.storage, input);
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
  if (matching.revision !== total.revision) throw new Error("Scale rows changed while counting them");
  // Extension APIs expose no database counters; the database layer diagnostic measures them.
  return { revision: total.revision, selected: matching.count, total: total.count, scanned: null };
};

// One bounded indexed page plus the counts a collection view shows with it.
const queryScalePage = async (storage: ExtensionStorageApi, input: Input) => {
  const start = performance.now();
  const page = await storage.records.query({
    index: scaleIndex,
    where: selectionWhere(input),
    fields: scaleViewFields,
    limit: 100,
    offset: (input.page ?? 0) * 100,
  });
  const counts = await countScaleRows(storage, input);
  if (counts.revision !== page.revision) throw new Error("Scale rows changed while reading one page");
  return {
    capability: "indexed-query",
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
