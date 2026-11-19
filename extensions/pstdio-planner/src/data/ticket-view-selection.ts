import { collectionViewSelection, formatViewDate } from "@pstdio/sdk/data";
import type {
  ExtensionContextBase,
  KanbanRendererQueryParams,
  StoragePredicate,
  StorageRecordQuery,
  ViewFilterGroup,
} from "@pstdio/sdk/extensions";
import { readPlanMetadata } from "../timeline/commands/placement-store";
import { timelineTicketAttributes } from "../timeline/model/ticket-properties";
import { buildTicketAttributes } from "./mappers";
import { ensureTicketStorage } from "./read-migrated-tickets";
import { seedDefaultStatuses, seedDefaultTags } from "./seed";
import { ticketSummaryFields } from "./ticket-query-summary";
import { ticketViewFields } from "./ticket-view-fields";
import { activeMilestoneValue, ticketViewState } from "./ticket-view-state";
import { readWorkflowStatuses, usableWorkflowStatuses } from "./workflow-statuses";

export type TicketQueryContext = Pick<
  ExtensionContextBase,
  "files" | "projectId" | "storage" | "settings" | "resources" | "extensionId"
>;
export interface TicketViewSelection {
  where?: StoragePredicate;
  visible?: StoragePredicate;
  orderBy?: StorageRecordQuery["orderBy"];
  groups?: string[];
  select?: string[];
  owner?: string;
  attentionPage?: string;
  pointTicketId?: string;
}
const filterFields = (filter?: ViewFilterGroup): string[] =>
  filter ? [...filter.rules.map(({ attributeId }) => attributeId), ...(filter.groups ?? []).flatMap(filterFields)] : [];

/** Share view semantics with automation without taking a UI snapshot. */
export const prepareTicketViewQuery = async (
  ctx: TicketQueryContext,
  input: Partial<KanbanRendererQueryParams>,
  selection: TicketViewSelection = {},
  displayFields?: readonly string[],
) => {
  await ensureTicketStorage(ctx);
  const [tags, statuses] = await Promise.all([seedDefaultTags(ctx.storage), seedDefaultStatuses(ctx.storage)]);
  const [workflow] = await Promise.all([readWorkflowStatuses(ctx), readPlanMetadata(ctx.storage)]);
  const before = await ctx.storage.records.query({ index: "ticket-view", fields: [], limit: 0, orderBy: [] });
  const point = selection.pointTicketId
    ? await ctx.storage.records.query({
        index: "ticket-view",
        fields: ["deadlineId"],
        limit: 1,
        orderBy: [],
        revision: before.revision,
        where: { field: "id", op: "eq", value: selection.pointTicketId },
      })
    : undefined;
  const deadlineId = point?.records[0]?.fields.deadlineId;
  const pointDeadline = typeof deadlineId === "string" ? deadlineId : null;
  const groups = [input.settings?.columnGrouping ?? "status", input.settings?.rowGrouping ?? "none"];
  const requested = new Set([
    ...(displayFields ?? []),
    ...filterFields(input.filter),
    ...groups,
    ...(input.sorts ?? []).map(({ attributeId }) => attributeId),
    ...(input.page?.search ? (input.page.searchFields ?? input.page.fields) : []),
  ]);
  const state = await ticketViewState(
    ctx.storage,
    usableWorkflowStatuses(workflow),
    point ? pointDeadline : undefined,
    displayFields ? requested : undefined,
  );
  const { computed, metadata } = state;
  const attributes = [...buildTicketAttributes(statuses, tags), ...timelineTicketAttributes(metadata.deadlines)];
  const dateSort = input.sorts?.[0]?.attributeId;
  const calendarField = ({ created: "createdCalendarOnly", updated: "updatedCalendarOnly" } as Record<string, string>)[
    dateSort ?? ""
  ];
  const calendarRows = calendarField
    ? await ctx.storage.records.query({
        index: "ticket-view",
        fields: [],
        limit: 1,
        orderBy: [],
        revision: before.revision,
        where: { field: calendarField, op: "eq", value: true },
      })
    : undefined;
  const fields = ticketViewFields(attributes, tags, computed, requested, !calendarRows?.records.length);
  // The date-control translator requests calendar projections for indexed inputs.
  // Translate these locally after it emits the format, using Planner's milestone metadata.
  const { milestoneDate: _milestoneDate, ...viewComputed } = computed;
  const scope = collectionViewSelection({
    index: "ticket-view",
    computed: viewComputed,
    fields,
    groups,
    filter: input.filter,
    sorts: input.sorts,
    searchFields: input.page?.searchFields ?? input.page?.fields ?? ["title", "id"],
    select: [
      ...ticketSummaryFields,
      "breadcrumb",
      ...["milestone", "milestoneDate", "milestoneState", "needsAttention", "reviewRequests"].filter(
        (field) => !input.page?.fields || input.page.fields.includes(field),
      ),
    ],
    orderBy: [{ field: "position", direction: "asc" }],
    page: input.page,
    ...selection,
  });
  Object.assign(computed, scope.computed);
  for (const [name, format] of Object.entries(scope.formats ?? {})) {
    if (format.field !== "milestoneDate") continue;
    delete scope.formats![name];
    const values = Object.fromEntries(
      metadata.deadlines.map(({ id, date }) => [id, formatViewDate(date, format) ?? null]),
    );
    computed[name] = {
      type: format.part === "text" ? "string" : "number",
      expression: activeMilestoneValue(values, null),
    };
  }
  scope.page = {
    limit: 100,
    offset: 0,
    fields: [],
    search: "",
    ...scope.page,
    revision: scope.page?.revision ?? before.revision,
  };
  // Summary flags belong to individual aggregate requests, not every card page.
  scope.computed = Object.fromEntries(Object.entries(computed).filter(([name]) => !name.startsWith("flag:")));
  return {
    attributes,
    tags,
    statuses,
    workflow: usableWorkflowStatuses(workflow),
    computed,
    metadata,
    fields,
    predicates: state.predicates,
    conditions: state.conditions,
    scope,
    revision: before.revision,
  };
};
