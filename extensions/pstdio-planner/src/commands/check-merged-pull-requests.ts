import { type CommandContext, defineCommand, defineSchedule } from "@pstdio/sdk/extensions";
import { recordSubmittedMerge } from "../data/attempt-merges";
import { readTicketAttempts, readWorkspaceEvents } from "../data/attempt-queries";
import { readRetiredWorkspaceIds } from "../data/attempt-retirement";
import type { AttemptRecord, AttemptTimelineEvent } from "../data/attempt-types";
import { upgradeAttemptStorage } from "../data/attempt-upgrade";
import { ticketsCollection } from "../data/collections";
import { markTicketsDone } from "../data/mark-tickets-done";
import { mergeTicketPages } from "../data/merge-ticket-query";
import {
  findMergedGithubPrs,
  type GithubReads,
  isPullRequest,
  linkedPullRequests,
  type PullRequestRead,
  readGithubResources,
  ticketReference,
} from "../data/pull-request-resources";
import { pullRequestTarget } from "../data/pull-request-target";
import { preparePlannerIndexes } from "../data/storage-indexes";
import type { Ticket } from "../data/types";
import { readMergeDestination } from "../data/workflow-statuses";

const referenceOnlyPullRequests = async (ctx: CommandContext, ticketId: string) => {
  const ids = new Set<string>();
  let cursor: string | undefined;
  do {
    const page = await ctx.resources.queryAnchors({
      resource: ticketReference(ctx, ticketId),
      direction: "outgoing",
      cursor,
      limit: 100,
    });
    for (const { target } of page.items) if (isPullRequest(target) && target.role !== "result") ids.add(target.id);
    cursor = page.nextCursor ?? undefined;
  } while (cursor);
  return ids;
};

const cachedReferenceOnlyPullRequests = (
  ctx: CommandContext,
  ticketId: string,
  cache: Map<string, Promise<Set<string>>>,
) => {
  let read = cache.get(ticketId);
  if (!read) {
    read = referenceOnlyPullRequests(ctx, ticketId);
    cache.set(ticketId, read);
  }
  return read;
};

const addWorkspacePullRequests = async (
  ctx: CommandContext,
  attempts: AttemptRecord[],
  links: Map<string, Set<string>>,
) => {
  const workspaces = (
    await Promise.all([...new Set(attempts.map(({ workspaceId }) => workspaceId))].map((id) => ctx.workspaces.get(id)))
  )
    .filter((workspace) => workspace !== null)
    .filter((workspace) => Boolean(workspace.branch));
  const references = new Map<string, Promise<Set<string>>>();
  for (let offset = 0; offset < workspaces.length; offset += 100) {
    const batch = workspaces.slice(offset, offset + 100);
    try {
      const found = await ctx.commands.execute(findMergedGithubPrs, {
        params: { branches: batch.map((workspace) => workspace.branch!) },
      });
      if (!found.ok) continue;
      for (const pr of found.value) {
        const ids = links.get(pr.id) ?? new Set<string>();
        const candidates = batch
          .filter((workspace) => workspace.branch === pr.branch)
          .flatMap((workspace) =>
            attempts.filter((attempt) => attempt.workspaceId === workspace.id).map((attempt) => attempt.ticketId),
          );
        for (const ticketId of new Set(candidates)) {
          if (!(await cachedReferenceOnlyPullRequests(ctx, ticketId, references)).has(pr.id)) ids.add(ticketId);
        }
        if (ids.size) links.set(pr.id, ids);
      }
    } catch {
      /* Keep local work usable when GitHub is disabled. */
    }
  }
};

const readSubmissionPullRequests = async (ctx: CommandContext, tickets: Ticket[]) => {
  const unavailable = new Set<string>();
  const links = new Map<string, Set<string>>();
  for (const ticket of tickets) {
    const resources = await linkedPullRequests(ctx, ticket);
    if (!resources) {
      unavailable.add(ticket.id);
      continue;
    }
    for (const link of resources) {
      const ids = links.get(link.id) ?? new Set<string>();
      ids.add(ticket.id);
      links.set(link.id, ids);
    }
  }
  return { links, unavailable };
};

const pendingSubmissions = (
  tickets: Ticket[],
  attempts: AttemptRecord[],
  retired: Set<string>,
  events: AttemptTimelineEvent[],
  destinationId?: string,
) => {
  const activeTickets = new Map(tickets.filter((ticket) => !ticket.archived).map((ticket) => [ticket.id, ticket]));
  const current = attempts.filter(
    (attempt) => !retired.has(attempt.workspaceId) && activeTickets.has(attempt.ticketId) && attempt.revisions.length,
  );
  const receipts = new Set(
    events
      .filter((event) => event.type === "attempt_merged")
      .map((event) => `${event.workspaceId}:${event.metadata.headSha}`),
  );
  const unrecorded = new Set(
    current
      .filter((attempt) => !receipts.has(`${attempt.workspaceId}:${attempt.revisions.at(-1)!.headSha}`))
      .map((attempt) => attempt.ticketId),
  );
  return current.filter(
    (attempt) => activeTickets.get(attempt.ticketId)?.statusId !== destinationId || unrecorded.has(attempt.ticketId),
  );
};

const deliveredMerge = (pr: PullRequestRead, target: { branch: string; repository: string }) => {
  if (
    "error" in pr ||
    pr.state !== "MERGED" ||
    !pr.mergeCommit?.oid ||
    pr.baseRefName !== target.branch ||
    !pr.id.startsWith(`${target.repository}/pull/`)
  )
    return null;
  return { headSha: pr.headRefOid, mergeSha: pr.mergeCommit.oid };
};

const recordDeliveredLinks = async (
  ctx: CommandContext,
  attempts: AttemptRecord[],
  links: Map<string, Set<string>>,
  target: NonNullable<Awaited<ReturnType<typeof pullRequestTarget>>>,
  reads: GithubReads,
) => {
  const mergedIds = new Set<string>();
  for (const pr of await readGithubResources(ctx, [...links.keys()], reads)) {
    const merged = deliveredMerge(pr, target);
    if (!merged) continue;
    for (const attempt of attempts) {
      if (!links.get(pr.id)?.has(attempt.ticketId) || attempt.revisions.at(-1)?.headSha !== merged.headSha) continue;
      await recordSubmittedMerge(ctx, attempt, merged.mergeSha);
      mergedIds.add(attempt.ticketId);
    }
  }
  await markTicketsDone(ctx, [...mergedIds]);
};

export const checkMergedPullRequestsCommand = defineCommand({
  id: "check-merged-pull-requests",
  title: "Check merged pull requests",
  mutating: true,
  async run(ctx) {
    if ((await ctx.settings.get("tickets.markDoneOnMerge")) === false) return;
    const destination = await readMergeDestination(ctx);
    // Only a submitted attempt can record a merge. Idle projects need no ticket scan.
    await preparePlannerIndexes(ctx.storage);
    await upgradeAttemptStorage(ctx.storage);
    const attempts = await ctx.storage.records.query({ index: "attempt-ticket", fields: [], orderBy: [], limit: 1 });
    if (!attempts.records.length) return destination.status ? undefined : { reason: destination.reason };
    const reads: GithubReads = new Map();
    for await (const metadata of mergeTicketPages(ctx.storage)) {
      const allAttempts = await readTicketAttempts(
        ctx.storage,
        metadata.map(({ id }) => id),
      );
      const workspaceIds = allAttempts.map(({ workspaceId }) => workspaceId);
      const [retired, events, selected] = await Promise.all([
        readRetiredWorkspaceIds(ctx.storage, workspaceIds),
        readWorkspaceEvents(ctx.storage, workspaceIds),
        Promise.all(
          metadata
            .filter(({ id }) => allAttempts.some((attempt) => attempt.ticketId === id))
            .map(({ id }) => ticketsCollection(ctx).get(id)),
        ),
      ]);
      const tickets = selected.filter((ticket) => ticket !== undefined);
      const attempts = pendingSubmissions(tickets, allAttempts, retired, events, destination.status?.id);
      const activeIds = new Set(attempts.map((attempt) => attempt.ticketId));
      const { links, unavailable } = await readSubmissionPullRequests(
        ctx,
        tickets.filter((ticket) => activeIds.has(ticket.id)),
      );
      // Implicit branch discovery never overrides a canonical reference choice or an incomplete migration.
      await addWorkspacePullRequests(
        ctx,
        attempts.filter((attempt) => !unavailable.has(attempt.ticketId)),
        links,
      );
      if (!links.size) continue;
      const target = await pullRequestTarget(ctx);
      if (!target) return { reason: "The Git delivery target is unavailable." };
      await recordDeliveredLinks(ctx, attempts, links, target, reads);
    }
    return destination.status ? undefined : { reason: destination.reason };
  },
});
export const mergedPullRequestsSchedule = defineSchedule({
  id: "check-merged-pull-requests",
  title: "Check merged pull requests",
  schedule: "*/5 * * * *",
  command: checkMergedPullRequestsCommand.ref,
});
