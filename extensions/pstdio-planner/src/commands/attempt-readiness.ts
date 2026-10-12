import { type CommandContext, defineCommand, params } from "@pstdio/sdk/extensions";
import { type AttemptReadinessTicket, resolveAttemptReadiness } from "../data/attempt-readiness";
import { attemptSelectionsCollection, listAttempts } from "../data/attempt-storage";
import { statusesCollection, ticketsCollection } from "../data/collections";
import { findTicket } from "../data/resolve";
import { readTicketReviewRequests } from "../data/review-request-storage";

type ReadinessContext = Pick<CommandContext, "process" | "workspaces" | "sessions" | "settings" | "storage">;

interface ReadinessParams {
  base?: string;
  dependencyReview?: "approved" | "submitted";
}

export async function readImplementationCapacity(ctx: Pick<ReadinessContext, "storage" | "sessions" | "settings">) {
  const attempts = await listAttempts(ctx.storage);
  const active = attempts.filter(
    (attempt) => attempt.state === "implementing" || attempt.state === "changes_requested",
  );
  const sessions = await Promise.all(active.map((attempt) => ctx.sessions.get(attempt.implementationSessionId)));
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

export const loadAttemptReadiness = async (
  ctx: ReadinessContext,
  ticketRef: string,
  commandParams: ReadinessParams,
) => {
  const [storedTickets, attempts, selections, statuses, home, providers, requests] = await Promise.all([
    ticketsCollection(ctx.storage).list(),
    listAttempts(ctx.storage),
    attemptSelectionsCollection(ctx.storage).list(),
    statusesCollection(ctx.storage).list(),
    ctx.workspaces.getDefault(),
    ctx.workspaces.listProviders(),
    readTicketReviewRequests(ctx.storage),
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

  const capacity = await readImplementationCapacity(ctx);
  const mainHeadSha = await runGit(ctx, rootPath, [
    "rev-parse",
    "--verify",
    "--end-of-options",
    `${commandParams.base ?? "HEAD"}^{commit}`,
  ]);
  const doneStatusIds = new Set(
    statuses.filter((status) => status.name.trim().toLowerCase() === "done").map((status) => status.id),
  );

  const readiness = await resolveAttemptReadiness({
    requests,
    target: target.id,
    tickets,
    attempts,
    selections,
    dependencyReview: commandParams.dependencyReview,
    doneStatusIds,
    mainHeadSha,
    activeImplementationCount: capacity.running,
    maxInProgress: capacity.limit,
    isAncestor: async (baseSha, headSha) => {
      const result = await ctx.process.run({
        command: ["git", "-C", rootPath, "merge-base", "--is-ancestor", baseSha, headSha],
      });
      if (result.exitCode === 0) return true;
      if (result.exitCode === 1) return false;
      throw new Error(result.stderr.trim() || "Could not compare dependency commits.");
    },
  });

  return { readiness, workspace: home, target, capacity };
};

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
