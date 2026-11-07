import {
  defineCommand,
  defineExtension,
  type ExtensionContextBase,
  type ExtensionStorageApi,
  params,
} from "@pstdio/sdk/extensions";
import {
  type FixtureRow,
  matches,
  plannerScaleField,
  type Selection,
  scaleScopePredicate,
  scaleSelectionPredicate,
  scaleStorageIndexes,
  scaleViewFields,
} from "storage-scale-fixture";

import { consistentRead } from "./storage-scale-consistent-read";

export { createScaleViews } from "./storage-scale-views";

interface Input {
  action: "seed" | "adopt" | "read" | "record" | "page" | "aggregate" | "commit" | "outcome" | "stats";
  planner?: boolean;
  rows?: FixtureRow[];
  /** Planner ticket IDs for `adopt`, in row order. */
  tickets?: string[];
  deleted?: string[];
  operationId?: string;
  id?: string;
  selection?: Selection;
  page?: number;
  count?: number;
  restore?: boolean;
}

type PlannerTicket = Record<string, unknown> & { [plannerScaleField]?: FixtureRow };

// Planner keeps its own ticket fields; the fixture sets the title and status its views show and
// holds the generator row beside them.
export const plannerTicket = (ticket: PlannerTicket, row: FixtureRow, count: number) => ({
  ...ticket,
  title: row.title,
  statusId: matches(row, "focus", count) ? "ready" : "backlog",
  [plannerScaleField]: row,
});

// At most 100 tickets per lookup, the public query limit; the identity index finds each by ID.
const plannerAddresses = async (storage: ExtensionStorageApi, ids: string[]) => {
  const addresses = new Map<string, { recordId: string; wrapper: { value: PlannerTicket } }>();
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
        wrapper: record.value as { value: PlannerTicket },
      });
  }
  return addresses;
};

// Planner created these tickets through its own command; give each its first generator row.
const adoptPlannerTickets = async (storage: ExtensionStorageApi, input: Input) => {
  const tickets = storage.collection<PlannerTicket>("tickets");
  for (const [index, row] of (input.rows ?? []).entries()) {
    const id = input.tickets![index];
    const observed = await tickets.read(id);
    if (!observed) throw new Error(`Planner ticket missing: ${id}`);
    if (!(await tickets.updateIfUnchanged(id, observed.revision, plannerTicket(observed.value, row, input.count!))))
      throw new Error(`Planner ticket changed while the fixture adopted it: ${id}`);
  }
  return { status: "saved-locally", atomic: false };
};

const saveRows = async (
  storage: ExtensionStorageApi,
  resources: Pick<ExtensionContextBase["resources"], "removed">,
  input: Input,
) => {
  if (input.planner) {
    // Discover opaque addresses through the public indexed API and keep them unchanged.
    const addresses = await plannerAddresses(storage, [
      ...(input.rows ?? []).map((row) => row.id),
      ...(input.deleted ?? []),
    ]);
    const existing = (id: string) => {
      const record = addresses.get(id);
      if (!record) throw new Error(`Planner seed record missing: ${id}`);
      return record;
    };
    const outcome = await storage.records.commit({
      operationId: input.operationId!,
      edits: [
        ...(input.rows ?? []).map((row) => {
          const { recordId, wrapper } = existing(row.id);
          return { recordId, replace: { ...wrapper, value: plannerTicket(wrapper.value, row, input.count!) } };
        }),
        ...(input.deleted ?? []).map((id) => ({ recordId: existing(id).recordId, deleted: true })),
      ],
    });
    // Like Planner's own delete, tell open views each removed ticket is gone.
    for (const id of input.deleted ?? [])
      await resources.removed({ type: "ticket", id: String(existing(id).wrapper.value.id) });
    return outcome;
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
      if (input.action === "adopt") return adoptPlannerTickets(ctx.storage, input);
      if (input.action === "seed" || input.action === "commit") {
        const start = performance.now();
        const outcome = await saveRows(ctx.storage, ctx.resources, input);
        return { outcome, durableAckMs: performance.now() - start };
      }
      if (input.action === "outcome") return ctx.storage.records.outcome(input.operationId!);
      if (input.action === "record") return ctx.storage.records.read(ctx.storage.records.id(input.id!));
      if (input.action === "read") {
        return input.planner
          ? (await plannerAddresses(ctx.storage, [input.id!])).get(input.id!)?.wrapper.value[plannerScaleField]
          : (await ctx.storage.records.read(ctx.storage.records.id(input.id!))).value;
      }
      if (input.action === "stats") {
        // Preparation verifies every stored row, so it alone reads whole owners. Planner's sizes
        // cover the whole stored ticket; its history comes from the generator row it holds.
        const stored = input.planner
          ? (await ctx.storage.collection<PlannerTicket>("tickets").list()).map((ticket) => ({
              value: ticket as object,
              row: ticket[plannerScaleField],
            }))
          : (await ctx.storage.records.list())
              .filter((record) => !record.deleted)
              .map((record) => ({ value: record.value as object, row: record.value as FixtureRow }));
        const all = stored.flatMap(({ value, row }) => (row ? [{ value, row }] : []));
        const sizes = all.map(({ value }) => Buffer.byteLength(JSON.stringify(value))).sort((a, b) => a - b);
        return {
          count: all.length,
          // Planner tickets without a generator row are tickets the fixture did not adopt.
          unadopted: stored.length - all.length,
          bytes: sizes.reduce((sum, bytes) => sum + bytes, 0),
          minBytes: sizes[0],
          medianBytes: sizes[Math.floor(sizes.length / 2)],
          maxBytes: sizes.at(-1),
          tail16KiB: sizes.filter((bytes) => bytes >= 16_384).length,
          fieldCount: Object.keys(all[0]?.value ?? {}).length,
          historyCounts: all.reduce<Record<string, number>>((counts, { row }) => {
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
  scaleScopePredicate(scaleSelectionPredicate(input.count!, input.selection ?? "focus"));

// The selection's count and the owner's total, from one committed revision.
const countScaleRows = async (storage: ExtensionStorageApi, input: Input) => {
  const matching = await storage.records.aggregate({ index: scaleIndex, where: selectionWhere(input) });
  // Owners hold only rows, so their stored count answers the total; Planner also stores statuses.
  const total = await storage.records.aggregate(
    input.planner ? { index: scaleIndex, where: scaleScopePredicate() } : { index: scaleIndex },
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
