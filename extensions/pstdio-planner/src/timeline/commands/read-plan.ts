import type { StoragePredicate } from "@pstdio/sdk/extensions";
import { defineCommand, type KanbanRendererQueryParams, params } from "@pstdio/sdk/extensions";
import { readTicketViewPage } from "../../data/query-ticket-page";
import { ensureTicketStorage } from "../../data/read-migrated-tickets";
import { ensureDefaultTags } from "../../data/seed";
import { timelineBoard } from "../../data/ticket-board";
import { ticketSummaryFields } from "../../data/ticket-query-summary";
import { activeTicket } from "../../data/ticket-view-state";
import { readCompletedStatusIds } from "../../data/workflow-statuses";
import { daysBetween } from "../model/days";
import type { MilestoneDisplay } from "../model/milestone-visibility";
import { summarizeSection } from "../model/section-summary";
import { initializePlanPlacements } from "./initialize-placements";
import { planPlacements } from "./placement-store";
import { planPageRows } from "./plan-page-rows";
import { planQuerySummary } from "./plan-query-summary";
import { planReadWindow } from "./plan-read-window";
import { planTicketRows } from "./plan-ticket-rows";
import { readTrack } from "./track-commands";

export interface PlanDisplay extends MilestoneDisplay {
  collapsedMilestones?: string[];
  collapsedTracks?: string[];
}

export const readPlanCommand = defineCommand({
  id: "timeline.plan.read",
  title: "Read execution plan",
  cli: { description: "Read a bounded page of the execution order with global milestone summaries." },
  params: {
    filter: params.json<KanbanRendererQueryParams["filter"]>(),
    page: params.json<KanbanRendererQueryParams["page"]>(),
    display: params.json<PlanDisplay>(),
    ticketId: params.text(),
    includeSavedViews: params.boolean(),
  },
  async run(ctx, input) {
    await ensureTicketStorage(ctx);
    const [completedStatusIds] = await Promise.all([readCompletedStatusIds(ctx), ensureDefaultTags(ctx.storage)]);
    const display = input.display;
    const hidden = Boolean(
      display?.collapsedMilestones?.length ||
        display?.collapsedTracks?.length ||
        display?.showCompletedMilestones === false ||
        display?.showPassedMilestones === false,
    );
    const { executionOffset, initializationCount } = planReadWindow(input, hidden);
    const selected = input.ticketId ? await planPlacements(ctx.storage).get(input.ticketId) : undefined;
    const initializedRevision = await initializePlanPlacements(
      ctx,
      completedStatusIds,
      selected ? 0 : initializationCount,
    );
    // Keep the active-prefix proof and the displayed page on the same snapshot.
    const readInput = initializedRevision
      ? {
          ...input,
          page: {
            limit: 100,
            offset: 0,
            fields: [],
            search: "",
            ...input.page,
            revision: input.page?.revision ?? initializedRevision,
          },
        }
      : input;
    const view = await readTicketViewPage(ctx, readInput, {
      where: input.ticketId ? { all: [activeTicket, { field: "id", op: "eq", value: input.ticketId }] } : activeTicket,
      // Metadata and tags used by visibility belong to query preparation's guarded revision.
      visible: async ({ metadata, tags }) => {
        const hidden = input.display?.collapsedMilestones ?? [];
        const visible: StoragePredicate[] = [];
        if (input.display?.collapsedTracks?.length) {
          const track = await readTrack(ctx, tags);
          const options = Object.fromEntries(track?.options.map(({ id }) => [id, true]) ?? []);
          const selected = {
            op: "first" as const,
            args: [
              {
                each: { get: { field: "tags" }, key: track?.id ?? "" },
                as: "trackOption",
                mode: "filter" as const,
                where: {
                  op: "eq" as const,
                  args: [{ get: { literal: options }, key: { variable: "trackOption" } }, { literal: true }],
                },
              },
            ],
          };
          const hidden = Object.fromEntries(input.display.collapsedTracks.map((id) => [id, true]));
          visible.push({
            not: {
              test: {
                op: "eq",
                args: [
                  {
                    get: { literal: hidden },
                    key: { op: "if", args: [{ op: "missing", args: [selected] }, { literal: "unassigned" }, selected] },
                  },
                  { literal: true },
                ],
              },
            },
          });
        }
        if (hidden.length)
          visible.push({ field: "deadlineId", op: "notIn", value: hidden.map((id) => (id === "none" ? null : id)) });
        if (input.display?.showCompletedMilestones === false)
          visible.push({ field: "milestoneState", op: "notIn", value: ["complete", "completed-past"] });
        if (input.display?.showPassedMilestones === false)
          visible.push({
            field: "deadlineId",
            op: "notIn",
            value: metadata.deadlines
              .filter(({ date }) => date < new Intl.DateTimeFormat("en-CA").format(new Date()))
              .map(({ id }) => id),
          });
        return visible.length ? { all: visible } : undefined;
      },
      groups: [],
      owner: ctx.extensionId,
      attentionPage: "timeline",
      pointTicketId: input.ticketId || undefined,
      orderBy: [
        { field: "deadlineRank", direction: "asc" },
        { field: "planPosition", direction: "asc" },
        { field: "id", direction: "asc" },
      ],
      select: [
        ...ticketSummaryFields,
        "breadcrumb",
        "milestone",
        "milestoneDate",
        "milestoneState",
        "hasUnfinishedDependent",
        "reviewRequests",
        "blockedReason",
        "independentBlockedReason",
        "hasUnmetDependency",
        "hasLaterDependency",
        "deadlineId",
        "planPosition",
        "gate",
      ],
    });
    if (view.tickets.some(({ id }) => typeof view.projections.get(id)?.planPosition !== "string"))
      throw new Error("Timeline execution order is stale; restart the query with a numeric offset");
    const [page, summary] = await Promise.all([
      planPageRows(ctx, view, executionOffset),
      // Selection outside the visible window needs only its row and section.
      input.ticketId ? undefined : planQuerySummary(ctx.storage, view, executionOffset !== undefined),
    ]);
    const deadlines = [...view.metadata.deadlines, null].filter(
      (deadline) => !input.ticketId || page.rows.some((row) => row.deadlineId === (deadline?.id ?? null)),
    );
    await ctx.storage.records.query({
      index: "ticket-view",
      fields: [],
      limit: 1,
      orderBy: [],
      revision: view.result.page.revision,
    });
    return {
      pace: summary?.pace ?? null,
      statuses: view.statuses,
      today: page.today,
      tags: view.tags,
      trackProperty: page.track,
      sections: deadlines.map((deadline) => {
        const section = {
          deadline: deadline ? { ...deadline, daysLeft: daysBetween(page.today, deadline.date) } : null,
          rows: page.rows.filter((row) => row.deadlineId === (deadline?.id ?? null)),
        };
        return summary
          ? { ...section, ...summary.section(deadline?.id ?? null) }
          : { ...summarizeSection(section, view.tags, null), globalCounts: undefined };
      }),
      projectId: ctx.projectId,
      savedViews:
        input.ticketId || input.includeSavedViews === false
          ? { views: [], defaultViewId: null }
          : await ctx.views.list(timelineBoard),
      ticketRows: planTicketRows(view, page.rows),
      ticketAttributes: view.result.attributes,
      page: view.result.page,
    };
  },
});
