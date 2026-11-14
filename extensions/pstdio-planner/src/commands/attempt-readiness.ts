import { type CommandContext, defineCommand, params } from "@pstdio/sdk/extensions";
import { readTicketAttempts, readWorkspaceEvents } from "../data/attempt-queries";
import {
  type AttemptReadinessTicket,
  resolveAttemptDependencies,
  resolveAttemptReadiness,
} from "../data/attempt-readiness";
import { readRetiredWorkspaceIds } from "../data/attempt-retirement";
import { attemptSelectionsCollection } from "../data/attempt-storage";
import type { TicketAttemptSelection } from "../data/attempt-types";
import { upgradeAttemptStorage } from "../data/attempt-upgrade";
import { type DependencyDeliveryReads, readDependencyDeliveries } from "../data/dependency-deliveries";
import { listTicketReviewRequests } from "../data/review-request-storage";
import type { TicketReviewRequests } from "../data/review-request-types";
import { preparePlannerIndexes } from "../data/storage-indexes";
import { readTicketDependencyClosure } from "../data/ticket-dependency-reads";
import { inBatches } from "../data/ticket-selection";
import { readWorkflowStatuses, usableWorkflowStatuses } from "../data/workflow-statuses";
import { isLiveSession } from "./auto-build-sessions";

type ReadinessContext = Pick<
  CommandContext,
  "process" | "workspaces" | "sessions" | "settings" | "storage" | "logger" | "resources"
>;

interface ReadinessParams {
  base?: string;
  requireMergedDependencies?: boolean;
}

export async function readImplementationCapacity(ctx: Pick<ReadinessContext, "storage" | "sessions" | "settings">) {
  await upgradeAttemptStorage(ctx.storage);
  await preparePlannerIndexes(ctx.storage);
  let running = 0,
    cursor: string | undefined;
  do {
    const page = await ctx.sessions.query({
      status: ["queued", "in_progress", "awaiting_input"],
      includeArchived: true,
      limit: 100,
      cursor,
    });
    if (page.items.length) {
      const ids = new Set<unknown>();
      let ownershipCursor: string | undefined;
      do {
        const owned = await ctx.storage.records.query({
          index: "attempt-session",
          where: { field: "implementationSessionId", op: "in", value: page.items.map(({ id }) => id) },
          fields: ["implementationSessionId"],
          limit: 100,
          cursor: ownershipCursor,
        });
        for (const { fields } of owned.records) ids.add(fields.implementationSessionId);
        ownershipCursor = owned.cursor ?? undefined;
      } while (ownershipCursor && ids.size < page.items.length);
      // Several variants may share an implementation owner. Count each live session once.
      running += page.items.filter(({ id }) => ids.has(id)).length;
    }
    cursor = page.nextCursor ?? undefined;
  } while (cursor);
  const settings = await ctx.settings.all();
  const configured = settings["automation.maxInProgress"];
  return { running, limit: typeof configured === "number" ? configured : 2 };
}

const runGit = async (ctx: ReadinessContext, repoPath: string, args: string[]) => {
  const result = await ctx.process.run({ command: ["git", "-C", repoPath, ...args] });
  if (result.exitCode !== 0) throw new Error(result.stderr.trim() || `git ${args.join(" ")} failed`);
  return result.stdout.trim();
};

const loadDependencyInput = async (
  ctx: ReadinessContext,
  ticketRef: string,
  commandParams: ReadinessParams,
  deliveryReads?: DependencyDeliveryReads,
) => {
  const [{ selected: storedTarget, tickets: storedTickets }, statuses, home] = await Promise.all([
    readTicketDependencyClosure(ctx, ticketRef),
    readWorkflowStatuses(ctx),
    ctx.workspaces.getDefault(),
  ]);
  await upgradeAttemptStorage(ctx.storage);
  const attempts = await readTicketAttempts(
    ctx.storage,
    storedTickets.map(({ id }) => id),
  );
  const selections: TicketAttemptSelection[] = [];
  const requests = new Map<string, TicketReviewRequests>();
  await inBatches(storedTickets, async ({ id }) => {
    const [selection, group] = await Promise.all([
      attemptSelectionsCollection(ctx.storage).get(id),
      listTicketReviewRequests(ctx.storage, id),
    ]);
    if (selection) selections.push(selection);
    requests.set(id, group);
  });
  const workspaceIds = attempts.map(({ workspaceId }) => workspaceId);
  const events = await readWorkspaceEvents(ctx.storage, workspaceIds, "attempt_merged");
  const target: AttemptReadinessTicket = storedTarget ?? {
    id: ticketRef,
    shorthand: ticketRef,
    statusId: null,
    dependsOn: [],
  };
  const tickets = storedTarget ? storedTickets : [...storedTickets, target];
  const gitRequirement =
    "Planner attempts require a Git repository with a usable base commit. Tools and ordinary sessions remain available in the project folder.";
  if (!home?.root_path || home.execution_kind !== "local") throw new Error(gitRequirement);
  const rootPath = home.root_path;

  // Resolving the requested commit proves Git can supply the base. Provider form
  // discovery also lists every branch and is unnecessary for this command.
  const mainHeadSha = await runGit(ctx, rootPath, [
    "rev-parse",
    "--verify",
    "--end-of-options",
    `${commandParams.base ?? "HEAD"}^{commit}`,
  ]).catch((cause) => {
    throw new Error(gitRequirement, { cause });
  });
  const doneStatusIds = new Set(usableWorkflowStatuses(statuses).completedStatusIds);
  const activeImplementationWorkspaceIds = new Set<string>();
  await inBatches(attempts, async (attempt) => {
    if (isLiveSession(await ctx.sessions.get(attempt.implementationSessionId)))
      activeImplementationWorkspaceIds.add(attempt.workspaceId);
  });
  const input = {
    dependencyDeliveries: storedTarget
      ? await readDependencyDeliveries(ctx, storedTarget, storedTickets, doneStatusIds, rootPath, deliveryReads)
      : new Map(),
    mergedHeads: events.reduce((heads, event) => {
      const head = event.metadata.headSha;
      if (event.type === "attempt_merged" && typeof head === "string" && event.commitSha)
        heads.set(head, [...(heads.get(head) ?? []), event.commitSha]);
      return heads;
    }, new Map<string, string[]>()),
    activeImplementationWorkspaceIds,
    retiredWorkspaceIds: await readRetiredWorkspaceIds(ctx.storage, workspaceIds),
    requireMergedDependencies: commandParams.requireMergedDependencies,
    requests,
    target: target.id,
    tickets,
    attempts,
    selections,
    doneStatusIds,
    mainHeadSha,
    isAncestor: async (baseSha: string, headSha: string) => {
      const result = await ctx.process.run({
        command: ["git", "-C", rootPath, "merge-base", "--is-ancestor", baseSha, headSha],
      });
      if (result.exitCode === 0) return true;
      if (result.exitCode === 1) return false;
      // A recorded remote merge may not have been fetched into this repository yet.
      const present = await ctx.process.run({
        command: ["git", "-C", rootPath, "cat-file", "-e", `${baseSha}^{commit}`],
      });
      if (present.exitCode !== 0) return false;
      throw new Error(result.stderr.trim() || "Could not compare dependency commits.");
    },
  };
  return { input, workspace: home, target };
};

export async function loadAttemptDependencies(ctx: ReadinessContext, ticketRef: string, params: ReadinessParams) {
  const { input, workspace, target } = await loadDependencyInput(ctx, ticketRef, params);
  return { readiness: await resolveAttemptDependencies(input), workspace, target };
}

export async function loadAttemptReadiness(
  ctx: ReadinessContext,
  ticketRef: string,
  params: ReadinessParams,
  deliveryReads?: DependencyDeliveryReads,
) {
  const [{ input, workspace, target }, capacity] = await Promise.all([
    loadDependencyInput(ctx, ticketRef, params, deliveryReads),
    readImplementationCapacity(ctx),
  ]);
  const readiness = await resolveAttemptReadiness({
    ...input,
    activeImplementationCount: capacity.running,
    maxInProgress: capacity.limit,
  });
  return { readiness, workspace, target, capacity };
}

export const attemptReadinessCommand = defineCommand({
  id: "attempt-readiness",
  title: "Read attempt readiness",
  cli: true,
  params: {
    ticket: params.text({ label: "Ticket", required: true }),
    base: params.text({ label: "Base revision", required: false }),
  },
  async run(ctx, commandParams) {
    return (await loadAttemptReadiness(ctx, commandParams.ticket, commandParams)).readiness;
  },
});
