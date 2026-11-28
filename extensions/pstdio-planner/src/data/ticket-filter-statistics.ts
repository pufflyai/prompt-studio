import type { CollectionPage, StorageAggregateQuery, StoragePredicate } from "@pstdio/sdk/extensions";
import { ticketTagAttributeId } from "./mappers";
import { ticketViewComputedFields, ticketViewFields } from "./ticket-view-fields";
import type { prepareTicketViewQuery, TicketQueryContext } from "./ticket-view-selection";

type TicketView = Awaited<ReturnType<typeof prepareTicketViewQuery>>;
type Storage = TicketQueryContext["storage"];
type Statistic = NonNullable<CollectionPage["statistics"]>[string];
type Count = (input: Omit<StorageAggregateQuery, "index">) => ReturnType<Storage["records"]["aggregate"]>;
type Computed = NonNullable<StorageAggregateQuery["computed"]>;

const optionCounts = async (
  count: Count,
  field: string,
  tagId: string | undefined,
  options: string[],
  all: StoragePredicate[],
  computed: Computed,
  formatCount: number,
) => {
  const counts = new Map<string, number>();
  if (tagId === undefined) {
    for (let start = 0; start < options.length; start += 500) {
      const where: StoragePredicate = { all: [...all, { field, op: "in", value: options.slice(start, start + 500) }] };
      for (const { value, count: total } of (await count({ where, computed, groupBy: field, groupLimit: 500 })).groups)
        if (typeof value === "string") counts.set(value, total);
    }
    return counts;
  }
  // Multi-select options count tickets independently, including tickets with multiple selections.
  const batchSize = Math.max(1, Math.min(16, 32 - Object.keys(computed).length - formatCount));
  for (let start = 0; start < options.length; start += batchSize) {
    const batch = options.slice(start, start + batchSize);
    if (batch.length === 1) {
      const value = batch[0];
      counts.set(
        value,
        (await count({ where: { all: [...all, { field, op: "overlaps", value: [value] }] }, computed })).count,
      );
      continue;
    }
    const metrics: NonNullable<StorageAggregateQuery["metrics"]> = {};
    const match = { ...computed };
    for (const [index, value] of batch.entries()) {
      const key = `option:${index}`;
      match[key] = {
        type: "number",
        expression: {
          op: "if",
          args: [
            {
              each: { get: { field: "tags" }, key: tagId },
              as: "selection",
              mode: "some",
              where: { op: "eq", args: [{ variable: "selection" }, { literal: value }] },
            },
            { literal: 1 },
            { literal: 0 },
          ],
        },
      };
      metrics[key] = { field: key, operation: "sum" };
    }
    const aggregate = await count({ where: { all }, computed: match, metrics });
    for (const [index, value] of batch.entries()) counts.set(value, aggregate.metrics?.[`option:${index}`] ?? 0);
  }
  return counts;
};

export const readTicketFilterStatistics = async (storage: Storage, view: TicketView, page: CollectionPage) => {
  const descriptors = view.attributes.filter(
    (field) => field.filterable && (field.type.kind === "enum" || field.type.kind === "enum-multi"),
  );
  const computed = { ...view.scope.computed };
  const fields = ticketViewFields(view.attributes, view.tags, computed, new Set(descriptors.map(({ id }) => id)));
  const all = [view.scope.where, view.scope.search].filter((part) => part !== undefined);
  const tags = new Map(view.tags.map((tag) => [ticketTagAttributeId(tag), tag.id]));
  const formats = view.scope.formats;
  const count: Count = async (input) => {
    const result = await storage.records.aggregate({ index: view.scope.index, formats, ...input });
    if (result.revision !== page.revision) throw new Error("Collection query revision is stale; restart the query");
    return result;
  };
  const population = view.scope.visible
    ? page.groups.filter(({ parent }) => !parent).reduce((total, { count }) => total + count, 0)
    : page.filteredTotal;
  const result: Record<string, Statistic> = {};
  for (const { id, type } of descriptors) {
    if (type.kind !== "enum" && type.kind !== "enum-multi") continue;
    const options = type.options.map(({ value }) => value);
    const field = fields[id].field;
    const isGrouped = view.scope.groups[0]?.field === id && view.scope.groups.length === 1;
    const counts = isGrouped
      ? page.groups.flatMap(({ value, count }) => (typeof value === "string" ? [[value, count] as const] : []))
      : await optionCounts(
          count,
          field,
          type.kind === "enum-multi" ? tags.get(id) : undefined,
          options,
          all,
          ticketViewComputedFields(computed, [all, { field }, ...Object.values(formats ?? {})]),
          Object.keys(formats ?? {}).length,
        );
    result[id] = {
      type: "top-values",
      values: [...counts].map(([label, count]) => ({
        label,
        count,
        percentage: population ? (100 * count) / population : 0,
      })),
    };
  }
  return result;
};
