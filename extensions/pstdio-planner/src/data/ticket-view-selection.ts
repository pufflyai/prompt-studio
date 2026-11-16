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
import { ticketViewState } from "./ticket-view-state";
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
}
const filterFields = (filter?: ViewFilterGroup): string[] =>
  filter ? [...filter.rules.map(({ attributeId }) => attributeId), ...(filter.groups ?? []).flatMap(filterFields)] : [];

/** Share view semantics with automation without taking a UI snapshot. */
export const prepareTicketViewQuery = async (
  ctx: TicketQueryContext,
  input: Partial<KanbanRendererQueryParams>,
  selection: TicketViewSelection = {},
) => {
  await ensureTicketStorage(ctx);
  const [tags, statuses] = await Promise.all([seedDefaultTags(ctx.storage), seedDefaultStatuses(ctx.storage)]);
  const [workflow] = await Promise.all([readWorkflowStatuses(ctx, statuses), readPlanMetadata(ctx.storage)]);
  const before = await ctx.storage.records.query({ index: "ticket-view", fields: [], limit: 0, orderBy: [] });
  const state = await ticketViewState(ctx.storage, usableWorkflowStatuses(workflow));
  const { computed, metadata } = state;
  const attributes = [...buildTicketAttributes(statuses, tags), ...timelineTicketAttributes(metadata.deadlines)];
  const groups = [input.settings?.columnGrouping ?? "status", input.settings?.rowGrouping ?? "none"];
  const requested = new Set([
    ...filterFields(input.filter),
    ...groups,
    ...(input.sorts ?? []).map(({ attributeId }) => attributeId),
    ...(input.page?.search ? (input.page.searchFields ?? input.page.fields) : []),
  ]);
  const fields = ticketViewFields(attributes, tags, computed, requested);
  const scope = collectionViewSelection({
    index: "ticket-view",
    computed,
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
      expression: { get: { literal: values }, key: { field: "deadlineId" } },
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
