import { type CommandContext, defineCommand, l10n } from "@pstdio/sdk/extensions";
import { attemptEventsCollection, readAttempt } from "../data/attempt-storage";
import { autoBuildDispatches } from "../data/auto-build-dispatches";
import { readAutoBuildMode, saveAutoBuildMode } from "../data/auto-build-mode";
import { linkedAutoBuildRequests } from "../data/auto-build-ownership";
import { readAutoBuildSupervisor } from "../data/auto-build-supervisor";
import { withReviewRequestSession } from "../data/review-request-session";
import { reviewRequestsCollection } from "../data/review-request-storage";
import { withQueuedWriteGuard, withWriteGuard } from "../data/write-guard";

async function stopLinkedSessions(ctx: CommandContext, supervisorId: string | undefined) {
  if (!supervisorId) return;
  const linked = new Set<string>();
  const failures: unknown[] = [];
  const stop = async (id: string | null | undefined) => {
    if (!id || linked.has(id)) return;
    linked.add(id);
    try {
      // A finished conversation can still have queued follow-ups. Deleted conversations need no stop.
      if (await ctx.sessions.get(id)) await ctx.sessions.stop(id);
    } catch (reason) {
      failures.push(reason);
    }
  };
  await stop(supervisorId);
  const dispatches = await autoBuildDispatches(ctx, supervisorId).list();
  const workspaces = new Set(dispatches.map(({ workspaceId }) => workspaceId));
  for (const { workspaceId } of dispatches) {
    const attempt = await readAttempt(ctx.storage, workspaceId);
    await stop(attempt?.implementationSessionId);
    // An implementation can have requested a review just before it acknowledged cancellation.
    await withQueuedWriteGuard(ctx, `attempt:${workspaceId}`, async () => {
      const latest = await readAttempt(ctx.storage, workspaceId);
      const events = await attemptEventsCollection(ctx.storage).list();
      for (const revision of latest?.revisions ?? []) {
        for (const review of revision.reviews) await stop(review.sessionId);
      }
      for (const event of events.filter((event) => event.workspaceId === workspaceId)) await stop(event.sessionId);
    });
  }
  // A supervisor or worker can ask for input before a workspace is attached to the request.
  const visited = new Set<string>();
  let found = true;
  while (found) {
    found = false;
    const requests = linkedAutoBuildRequests(await reviewRequestsCollection(ctx.storage).list(), {
      workspaceIds: workspaces,
      sessionIds: linked,
    });
    for (const request of requests) {
      if (visited.has(request.id)) continue;
      visited.add(request.id);
      found = true;
      await withReviewRequestSession(ctx, request.id, async () => {
        const current = await reviewRequestsCollection(ctx.storage).get(request.id);
        await stop(current?.context.sessionId);
      });
    }
  }
  if (failures.length) throw new Error(failures.map(String).join("\n"));
}

export const stopAutoBuildCommand = defineCommand({
  id: "auto-build.stop",
  title: l10n("commands.autoBuild.stop", "Stop Auto Build"),
  cli: { description: "Stop the paused Auto Build and all its linked sessions." },
  mutating: true,
  async run(ctx) {
    return withWriteGuard(ctx, "auto-build-mode", async () => {
      const mode = await readAutoBuildMode(ctx);
      if (mode.state !== "paused") throw new Error("Pause Auto Build before stopping it.");
      // Launch and wake record ownership before releasing these guards. Pause already gates new work.
      return withQueuedWriteGuard(ctx, "attempt-launch", () =>
        withQueuedWriteGuard(ctx, "auto-build-supervisor", async () => {
          const owner = await readAutoBuildSupervisor(ctx);
          await stopLinkedSessions(ctx, owner.sessionId);
          // Failure leaves the paused run and its ownership intact so the same stop can be retried.
          return saveAutoBuildMode(ctx, { ...mode, state: "stopped", enabled: false, revision: crypto.randomUUID() });
        }),
      );
    });
  },
});
