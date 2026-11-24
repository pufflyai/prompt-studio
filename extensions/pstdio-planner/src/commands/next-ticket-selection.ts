import { resolveByIdOrName } from "@pstdio/sdk/data";
import type { CommandContext, StoragePredicate } from "@pstdio/sdk/extensions";
import { upgradeAttemptStorage } from "../data/attempt-upgrade";
import { readAutoBuildFilter } from "../data/auto-build-filter";
import type { AutoBuildMode } from "../data/auto-build-mode";
import { readAutoBuildSupervisor } from "../data/auto-build-supervisor";
import { requireTickets } from "../data/resolve";
import { ticketHasTag, ticketScopePredicate } from "../data/ticket-scope";
import { prepareTicketViewQuery } from "../data/ticket-view-selection";
import { activeTicket } from "../data/ticket-view-state";
import { initializePlanPlacements } from "../timeline/commands/initialize-placements";
import { readTrack } from "../timeline/commands/track-commands";
import type { NextTicketQuery } from "./next-ticket-query";

export const readNextTicketSelection = async (
  ctx: CommandContext,
  mode: AutoBuildMode,
  input: NextTicketQuery & { ticket?: string },
  scope?: NextTicketQuery[],
) => {
  await upgradeAttemptStorage(ctx.storage);
  const prepared = await prepareTicketViewQuery(ctx, { filter: mode.eligible }, { groups: [] });
  await initializePlanPlacements(ctx, prepared.workflow.completedStatusIds);
  const track = await readTrack(ctx, prepared.tags);
  const select = async (query: NextTicketQuery): Promise<StoragePredicate> => {
    const base = await ticketScopePredicate(ctx, query);
    if (!query.track) return base;
    const option = resolveByIdOrName(track?.options ?? [], query.track, ({ name }) => name, "track");
    return { all: [base, ticketHasTag(track!.id, option)] };
  };
  const supervisor = await readAutoBuildSupervisor(ctx);
  const saved = scope ?? (supervisor.scope?.revision === mode.revision ? supervisor.scope.queries : undefined);
  const eligible = readAutoBuildFilter(mode.eligible, [
    { id: "title", type: { kind: "string" }, filterable: true },
    ...prepared.attributes,
  ] as never);
  const started: StoragePredicate = {
    exists: {
      index: "attempt-ticket",
      on: [{ sourceField: "id", relatedField: "ticketId" }],
      where: {
        not: {
          exists: {
            index: "attempt-events-workspace",
            on: [{ sourceField: "attemptId", relatedField: "ownerAttemptId" }],
            where: { field: "type", op: "eq", value: "attempt_abandoned" },
          },
        },
      },
    },
  };
  const done: StoragePredicate = { field: "statusId", op: "in", value: prepared.workflow.completedStatusIds };
  const eligibleWhere = prepared.scope.where ?? { all: [] };
  const scoped: StoragePredicate = {
    all: [
      activeTicket,
      { field: "draft", op: "ne", value: true },
      { any: await Promise.all((saved ?? [{}]).map(select)) },
      { any: [done, started, eligibleWhere] },
    ],
  };
  const where: StoragePredicate = {
    all: [
      scoped,
      { not: done },
      await select(input),
      { any: [started, eligible.complete ? eligibleWhere : { any: [] }] },
      ...(input.ticket
        ? [
            {
              field: "id",
              op: "in",
              value: (await requireTickets(ctx, input.ticket)).map(({ id }) => id),
            } satisfies StoragePredicate,
          ]
        : []),
    ],
  };
  const query = { index: "ticket-view", computed: prepared.scope.computed, formats: prepared.scope.formats };
  const [total, unfinished, matching] = await Promise.all([
    ctx.storage.records.aggregate({
      ...query,
      where: scoped,
      metrics: { updated: { operation: "max", field: "updatedInstant" } },
      fingerprint: [
        "id",
        "statusId",
        "title",
        "dependsOn",
        "tags",
        "updatedAt",
        "reviewRequests",
        "planPosition",
        "deadlineId",
        "gate",
      ],
    }),
    ctx.storage.records.aggregate({ ...query, where: { all: [scoped, { not: done }] } }),
    ctx.storage.records.aggregate({ ...query, where }),
  ]);
  if (total.revision !== unfinished.revision || total.revision !== matching.revision)
    throw new Error("Work scope changed; query it again");
  return {
    ...query,
    where,
    revision: matching.revision,
    scoped,
    orderBy: [
      { field: "deadlineRank", direction: "asc" as const },
      { field: "planPosition", direction: "asc" as const },
      { field: "id", direction: "asc" as const },
    ],
    completed: Boolean(saved) && total.count > 0 && unfinished.count === 0,
    matchingTicketCount: matching.count,
    configurationError: eligible.complete ? null : "Complete or remove invalid eligible ticket filters.",
    workflow: prepared.workflow,
    progressAt: total.metrics?.updated ?? 0,
    fingerprint: total.fingerprint,
  };
};
