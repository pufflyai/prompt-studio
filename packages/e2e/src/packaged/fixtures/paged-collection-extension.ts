import {
  type CollectionPageRequest,
  type DataTableRendererQueryParams,
  defineCommand,
  defineExtension,
  defineNavigationItem,
  definePage,
  defineView,
  type ExtensionContextBase,
  type KanbanRendererQueryParams,
  params,
  type StoragePredicate,
  type StorageRecordIndex,
  type ViewFilterGroup,
  type ViewFilterRule,
  workbenchModes,
} from "@pstdio/sdk/extensions";

const fields: StorageRecordIndex["fields"] = {
  title: { path: ["title"], type: "string" },
  rank: { path: ["rank"], type: "number" },
  status: { path: ["status"], type: "string" },
  owner: { path: ["owner"], type: "string" },
};
const indexes: StorageRecordIndex[] = ["rank", "title", "status"].flatMap((field) =>
  (["asc", "desc"] as const).flatMap((direction) =>
    [false, true].map((grouped) => ({
      name: `${grouped ? "group-" : ""}${field}-${direction}`,
      fields,
      orderBy: [
        ...(grouped && field !== "status" ? [{ field: "status", direction: "asc" as const }] : []),
        { field, direction },
      ],
    })),
  ),
);
const textPredicate = (rule: ViewFilterRule) => {
  if (typeof rule.value !== "string" || !rule.value) return [];
  const match: StoragePredicate = {
    field: rule.attributeId,
    op: rule.condition.includes("contain") ? "contains" : "equalsIgnoreCase",
    value: rule.value,
  };
  return [rule.condition === "is-not" || rule.condition === "does-not-contain" ? { not: match } : match];
};
const predicate = (filter: ViewFilterGroup): StoragePredicate => {
  const group = (value: Pick<ViewFilterGroup, "conjunction" | "rules">): StoragePredicate => {
    const rules = value.rules.flatMap((rule): StoragePredicate[] => {
      const field = rule.attributeId;
      const text = fields[field]?.type === "string";
      if (text && ["is", "is-not", "contains", "does-not-contain"].includes(rule.condition)) {
        return textPredicate(rule);
      }
      switch (rule.condition) {
        case "is":
          return [{ field, op: "eq", value: rule.value ?? null }];
        case "is-not":
          return [{ field, op: "ne", value: rule.value ?? null }];
        case "contains":
          return [{ field, op: "contains", value: rule.value ?? "" }];
        case "gt":
        case "gte":
        case "lt":
        case "lte":
          return [{ field, op: rule.condition, value: rule.value ?? null }];
        case "is-any-of":
          return [{ field, op: "in", value: Array.isArray(rule.value) ? rule.value : [] }];
        case "is-none-of":
          return [{ field, op: "notIn", value: Array.isArray(rule.value) ? rule.value : [] }];
        case "is-empty":
          return [{ field, op: "empty" }];
        case "is-not-empty":
          return [{ field, op: "notEmpty" }];
        default:
          throw new Error(`Unsupported fixture condition: ${rule.condition}`);
      }
    });
    return value.conjunction === "or" && rules.length ? { any: rules } : { all: rules };
  };
  return { all: [group(filter), ...(filter.groups ?? []).map(group)] };
};

export const queryFixturePage = async (
  ctx: Pick<ExtensionContextBase, "storage">,
  input: DataTableRendererQueryParams | KanbanRendererQueryParams,
) => {
  const request = input.page;
  if (!request) throw new Error("This fixture requires the bounded page contract");
  const grouped = "grouping" in input.settings && input.settings.grouping === "status";
  const sort = input.sorts[0] ?? { attributeId: "rank", direction: "asc" };
  const index = `${grouped ? "group-" : ""}${sort.attributeId}-${sort.direction}`;
  const filter = predicate(input.filter);
  const search: StoragePredicate = request.search
    ? { any: ["title", "status"].map((field) => ({ field, op: "contains", value: request.search })) }
    : { all: [] };
  const searched: StoragePredicate = { all: [filter, search] };
  const where: StoragePredicate = {
    all: [
      searched,
      ...(grouped && request.collapsedGroups?.length
        ? [{ field: "status", op: "notIn" as const, value: request.collapsedGroups }]
        : []),
    ],
  };
  const records = ctx.storage.records;
  const selected = request.fields.filter((field) => field in fields);
  const rows = await records.query({
    index,
    where,
    fields: selected,
    limit: request.limit,
    ...(request.cursor ? { cursor: request.cursor } : { offset: request.offset }),
    revision: request.revision,
  });
  const total = await records.aggregate({ index, where: filter });
  const matches = await records.aggregate({ index, where });
  const groups = await records.aggregate({ index, where: searched, groupBy: "status" });
  if ([total, matches, groups].some((result) => result.revision !== rows.revision))
    throw new Error("The query revision changed");
  return {
    records: rows.records,
    page: {
      revision: rows.revision,
      cursor: rows.cursor,
      total: total.count,
      filteredTotal: matches.count,
      groups: groups.groups.map((group) => ({ field: "status", ...group })),
    },
  };
};

export const createPagedCollectionFixture = (owner: string) => {
  const changed = { kind: "event", id: "changed" } as const;
  const select = defineCommand({
    id: "selection",
    title: "Use selected rows",
    params: { rowIds: params.json<string[], { required: true }>({ required: true }) },
    run: (_ctx, input) => input.rowIds,
  });
  const seed = defineCommand({
    id: "seed",
    title: "Seed paged rows",
    mutating: true,
    async run(ctx) {
      const edits = Array.from({ length: 250 }, (_, rank) => ({
        recordId: ctx.storage.records.id(`row-${String(rank).padStart(4, "0")}`),
        replace: {
          title: `${owner} row ${String(rank).padStart(4, "0")}`,
          rank: Math.floor(rank / 2),
          status: rank % 2 ? "done" : "todo",
          owner,
          body: `OFF_PAGE_BODY_${owner}_${rank}_${"x".repeat(4096)}`,
        },
      }));
      return ctx.storage.records.commit({ operationId: "seed", edits });
    },
  });
  const change = defineCommand({
    id: "move",
    title: "Move paged row",
    mutating: true,
    params: { id: params.text({ required: true }), rank: params.number({ required: true }) },
    async run(ctx, input) {
      const id = ctx.storage.records.id(input.id);
      const row = await ctx.storage.records.read(id);
      const outcome = await ctx.storage.records.commit({
        operationId: crypto.randomUUID(),
        edits: [
          {
            recordId: id,
            expectedRevision: row.revision,
            replace: { ...(row.value as Record<string, unknown>), rank: input.rank },
          },
        ],
      });
      await ctx.events.emit(changed, {});
      return outcome;
    },
  });
  const table = defineView({
    id: "table",
    title: `${owner} table`,
    body: {
      kind: "dataTable",
      queryMode: "paged",
      initialPageSize: 100,
      refreshEvents: [changed],
      selectionMode: "multiple",
      selectionActions: [{ id: "selection", label: "Use selected rows", command: select.ref }],
      columns: [
        { id: "title", label: "Title", type: "string" },
        { id: "rank", label: "Rank", type: "number" },
        { id: "status", label: "Status", type: "string", groupable: true },
      ],
      defaultSettings: { showStats: false },
      defaultSorts: [{ attributeId: "rank", direction: "asc" }],
      query: async (ctx, input) => {
        const result = await queryFixturePage(ctx, input);
        return { rows: result.records.map((row) => ({ id: row.recordId, values: row.fields })), page: result.page };
      },
    },
  });
  const board = defineView({
    id: "board",
    title: `${owner} board`,
    body: {
      kind: "kanban",
      queryMode: "paged",
      refreshEvents: [changed],
      attributes: [
        { id: "rank", label: "Rank", type: { kind: "number" }, sortable: true, displayable: true },
        {
          id: "status",
          label: "Status",
          type: {
            kind: "enum",
            options: [
              { value: "todo", label: "Todo" },
              { value: "done", label: "Done" },
            ],
          },
          groupable: true,
          filterable: true,
        },
      ],
      defaultSettings: {
        viewMode: "board",
        columnGrouping: "status",
        rowGrouping: "none",
        displayProperties: ["rank"],
      },
      defaultSorts: [{ attributeId: "status", direction: "asc" }],
      query: async (ctx, input) => {
        const result = await queryFixturePage(ctx, input);
        return {
          rows: result.records.map((row) => ({
            id: row.recordId,
            title: String(row.fields.title),
            attributes: row.fields,
          })),
          page: result.page,
        };
      },
    },
  });
  const pages = [table, board].map((view) =>
    definePage({
      id: view.id,
      title: view.title,
      path: view.id,
      mode: workbenchModes.project,
      main: { kind: "view", view: view.ref, cardinality: "one" },
      slots: [],
    }),
  );
  return defineExtension({
    storageIndexes: indexes,
    commands: [seed, change, select],
    views: [table, board],
    pages,
    navigationItems: pages.map((page) =>
      defineNavigationItem({
        id: page.id,
        owner: workbenchModes.project,
        slot: "content",
        group: "Paged fixtures",
        label: page.title,
        action: { kind: "page", page: page.ref },
      }),
    ),
  });
};

export const initialFixturePage: CollectionPageRequest = {
  limit: 100,
  offset: 0,
  fields: ["title", "rank", "status"],
  search: "",
};
