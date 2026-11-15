import { type CommandContext, defineCommand, params, type StoragePredicate } from "@pstdio/sdk/extensions";
import { type AutoBuildMode, readAutoBuildMode } from "../data/auto-build-mode";
import type { DependencyDeliveryReads } from "../data/dependency-deliveries";
import { ticketSummaryFields } from "../data/ticket-query-summary";
import { readImplementationCapacity } from "./attempt-readiness";
import type { WorkObservation } from "./auto-build-observations";
import { visitNextTicketPage } from "./next-ticket-evidence";
import type { NextTicketQuery } from "./next-ticket-query";
import { readNextTicketSelection } from "./next-ticket-selection";
import type { NextTicket, WaitingTicket } from "./next-ticket-types";
import { nextWorkDigest } from "./next-work-snapshot";

export async function readNextTickets(
  ctx: CommandContext,
  mode: AutoBuildMode,
  input: NextTicketQuery & {
    base?: string;
    limit?: number;
    ticket?: string;
    offset?: number;
    revision?: string;
    scan?: boolean;
  } = {},
  savedScope?: NextTicketQuery[],
) {
  const capacity = await readImplementationCapacity(ctx);
  const selection = await readNextTicketSelection(ctx, mode, input, savedScope);
  if (input.revision && input.revision !== selection.revision)
    throw new Error("Work scope changed; restart its first page");
  const {
    workflow,
    completed,
    matchingTicketCount,
    configurationError,
    scoped,
    fingerprint: scopeFingerprint,
    ...query
  } = selection;
  const next: NextTicket[] = [],
    waiting: WaitingTicket[] = [],
    observations: WorkObservation[] = [];
  const deliveryReads: DependencyDeliveryReads = new Map();
  const state = {
    base: input.base,
    offset: input.offset ?? 0,
    examined: 0,
    progressAt: selection.progressAt,
    dependencies: "",
    more: matchingTicketCount > (input.offset ?? 0),
  };
  const limit = Math.min(100, input.limit ?? 100);
  if (!Number.isInteger(limit) || limit < 0) throw new Error("Choose a result limit from 0 to 100");
  while (limit > next.length && state.more) {
    const page = await ctx.storage.records.query({
      ...query,
      fields: [...ticketSummaryFields, "gate"],
      limit: 100,
      offset: state.offset,
    });
    if (!page.records.length) break;
    await visitNextTicketPage(ctx, page.records, state, {
      mode,
      workflow,
      capacity,
      next,
      waiting,
      observations,
      deliveryReads,
      limit,
      matchingTicketCount,
      requestedBase: input.base,
    });
    if (!input.scan) break;
  }
  const { offset, examined, more, dependencies, progressAt } = state;
  const requestSelection = {
    where: {
      exists: { index: query.index, on: [{ sourceField: "ticketId", relatedField: "id" }], where: scoped },
    } satisfies StoragePredicate,
    related: { [query.index]: { computed: query.computed, formats: query.formats } },
  };
  await ctx.storage.records.query({ index: query.index, fields: [], limit: 1, orderBy: [], revision: query.revision });
  const snapshot = await nextWorkDigest({
    scopeFingerprint,
    mode: mode.revision,
    scoped,
    capacity,
    next,
    waiting,
    dependencies,
  });
  return {
    tickets: next,
    waiting,
    capacity,
    completed,
    matchingTicketCount,
    observations,
    configurationError,
    requestSelection,
    nextOffset: more ? offset : null,
    revision: query.revision,
    waitingTruncated: examined > waiting.length && waiting.length === 100,
    snapshot,
    progressAt,
    active: capacity.running,
  };
}

export const nextTicketsCommand = defineCommand({
  id: "next-tickets",
  title: "Read next tickets",
  cli: {
    globalAliases: [["tickets", "next"]],
    description: "Query a bounded page of launchable tickets and waiting reasons using current Auto Build rules.",
    examples: ["pst pstdio.pstdio-planner next-tickets --track Workbench"],
  },
  params: {
    track: params.text(),
    status: params.text(),
    tags: params.list(),
    parent: params.text(),
    base: params.text({ label: "Root target branch" }),
    limit: params.number(),
    offset: params.number(),
    revision: params.text(),
  },
  async run(ctx, input) {
    const mode = await readAutoBuildMode(ctx);
    const { tickets, waiting, capacity, nextOffset, revision, matchingTicketCount } = await readNextTickets(
      ctx,
      mode,
      input,
    );
    return {
      enabled: mode.enabled,
      revision: mode.revision,
      tickets,
      waiting,
      capacity,
      nextOffset,
      queryRevision: revision,
      matchingTicketCount,
    };
  },
});
