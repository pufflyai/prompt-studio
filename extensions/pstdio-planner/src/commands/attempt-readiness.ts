import { type CommandContext, defineCommand, params } from "@pstdio/sdk/extensions";
import {
  type AttemptReadinessTicket,
  resolveAttemptDependencies,
  resolveAttemptReadiness,
} from "../data/attempt-readiness";
import { readRetiredWorkspaceIds } from "../data/attempt-retirement";
import { attemptEventsCollection, attemptSelectionsCollection, listAttempts } from "../data/attempt-storage";
import { ticketsCollection } from "../data/collections";
import { type DependencyDeliveryReads, readDependencyDeliveries } from "../data/dependency-deliveries";
import { findTicket } from "../data/resolve";
import { readTicketReviewRequests } from "../data/review-request-storage";
import { readWorkflowStatuses, usableWorkflowStatuses } from "../data/workflow-statuses";
import { isLiveSession } from "./auto-build-sessions";

type ReadinessContext = Pick<CommandContext, "process" | "workspaces" | "sessions" | "settings" | "storage" | "logger">;

interface ReadinessParams {
  base?: string;
  requireMergedDependencies?: boolean;
}

export async function readImplementationCapacity(ctx: Pick<ReadinessContext, "storage" | "sessions" | "settings">) {
  const attempts = await listAttempts(ctx.storage);
  const implementationIds = [...new Set(attempts.map(({ implementationSessionId }) => implementationSessionId))];
  const sessions = await Promise.all(implementationIds.map((id) => ctx.sessions.get(id)));
  const liveStatuses = new Set(["queued", "in_progress", "awaiting_input"]);
  const running = sessions.filter((session) => liveStatuses.has(session?.status ?? "")).length;
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
  const [storedTickets, attempts, selections, statuses, home, providers, requests, events] = await Promise.all([
    ticketsCollection(ctx.storage).list(),
    listAttempts(ctx.storage),
    attemptSelectionsCollection(ctx.storage).list(),
    readWorkflowStatuses(ctx),
    ctx.workspaces.getDefault(),
    ctx.workspaces.listProviders(),
    readTicketReviewRequests(ctx.storage),
    attemptEventsCollection(ctx.storage).list(),
  ]);
  const storedTarget = await findTicket(ctx.storage, ticketRef);
  const target: AttemptReadinessTicket = storedTarget ?? {
    id: ticketRef,
    shorthand: ticketRef,
    statusId: null,
    dependsOn: [],
  };
  const tickets = storedTarget ? storedTickets : [...storedTickets, target];
  if (
    !home?.root_path ||
    home.execution_kind !== "local" ||
    !providers.some((provider) => provider.id === "pstdio.worktree")
  ) {
    throw new Error(
      "Planner attempts require a Git repository with a usable base commit. Tools and ordinary sessions remain available in the project folder.",
    );
  }
  const rootPath = home.root_path;

  const mainHeadSha = await runGit(ctx, rootPath, [
    "rev-parse",
    "--verify",
    "--end-of-options",
    `${commandParams.base ?? "HEAD"}^{commit}`,
  ]);
  const doneStatusIds = new Set(usableWorkflowStatuses(statuses).completedStatusIds);
  const owners = await Promise.all(
    attempts.map(async (attempt) => ({
      workspaceId: attempt.workspaceId,
      session: await ctx.sessions.get(attempt.implementationSessionId),
    })),
  );
  const activeImplementationWorkspaceIds = new Set(
    owners.filter(({ session }) => isLiveSession(session)).map(({ workspaceId }) => workspaceId),
  );
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
    retiredWorkspaceIds: await readRetiredWorkspaceIds(ctx.storage),
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
