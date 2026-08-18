import { type CommandContext, defineCommand, params } from "@pstdio/sdk/extensions";
import { type AttemptReadinessTicket, resolveAttemptReadiness } from "../data/attempt-readiness";
import { attemptSelectionsCollection, listAttempts } from "../data/attempt-storage";
import { statusesCollection, ticketsCollection } from "../data/collections";
import { findTicket } from "../data/resolve";

type ReadinessContext = Pick<
  CommandContext<{ ticket?: string; repoId?: string; repo?: { repoId: string; branch?: string } }>,
  "params" | "process" | "repos" | "sessions" | "settings" | "storage" | "repo"
>;

const runGit = async (ctx: ReadinessContext, repoPath: string, args: string[]) => {
  const result = await ctx.process.run({ command: ["git", "-C", repoPath, ...args] });
  if (result.exitCode !== 0) throw new Error(result.stderr.trim() || `git ${args.join(" ")} failed`);
  return result.stdout.trim();
};

export const loadAttemptReadiness = async (ctx: ReadinessContext, ticketRef: string) => {
  const [storedTickets, attempts, selections, statuses, repos] = await Promise.all([
    ticketsCollection(ctx.storage).list(),
    listAttempts(ctx.storage),
    attemptSelectionsCollection(ctx.storage).list(),
    statusesCollection(ctx.storage).list(),
    ctx.repos.list(),
  ]);
  const storedTarget = await findTicket(ctx.storage, ticketRef);
  const target: AttemptReadinessTicket = storedTarget ?? {
    id: ticketRef,
    shorthand: ticketRef,
    statusId: null,
    dependsOn: [],
    parallelizable: null,
  };
  const tickets = storedTarget ? storedTickets : [...storedTickets, target];
  const repo =
    repos.find((candidate) => candidate.repoId === (ctx.params.repoId ?? ctx.params.repo?.repoId)) ??
    ctx.repo ??
    repos.find((candidate) => candidate.role === "default") ??
    repos[0];
  if (!repo) throw new Error("A repository is required to start an attempt.");

  const liveStatuses = new Set(["queued", "in_progress", "awaiting_input"]);
  const active = attempts.filter(
    (attempt) => attempt.state === "implementing" || attempt.state === "changes_requested",
  );
  const sessions = await Promise.all(active.map((attempt) => ctx.sessions.get(attempt.implementationSessionId)));
  const hasActiveImplementation = sessions.some((session) => liveStatuses.has(session?.status ?? ""));
  const activeImplementationCount = sessions.filter((session) => liveStatuses.has(session?.status ?? "")).length;
  const settings = await ctx.settings.all();
  const configuredCapacity = settings["automation.maxInProgress"];
  const maxInProgress = typeof configuredCapacity === "number" ? configuredCapacity : 2;
  const mainHeadSha = await runGit(ctx, repo.path, ["rev-parse", ctx.params.repo?.branch ?? "HEAD"]);
  const doneStatusIds = new Set(
    statuses.filter((status) => status.name.trim().toLowerCase() === "done").map((status) => status.id),
  );

  const readiness = await resolveAttemptReadiness({
    target: target.id,
    tickets,
    attempts,
    selections,
    doneStatusIds,
    mainHeadSha,
    hasActiveImplementation,
    activeImplementationCount,
    maxInProgress,
    isAncestor: async (baseSha, headSha) => {
      const result = await ctx.process.run({
        command: ["git", "-C", repo.path, "merge-base", "--is-ancestor", baseSha, headSha],
      });
      if (result.exitCode === 0) return true;
      if (result.exitCode === 1) return false;
      throw new Error(result.stderr.trim() || "Could not compare dependency commits.");
    },
  });

  return { readiness, repo, target };
};

export const attemptReadinessCommand = defineCommand({
  title: "Read attempt readiness",
  cli: true,
  params: {
    ticket: params.text({ label: "Ticket", required: true }),
    repoId: params.text({ label: "Repository", required: false }),
  },
  async run(ctx) {
    return (await loadAttemptReadiness(ctx, ctx.params.ticket)).readiness;
  },
});
