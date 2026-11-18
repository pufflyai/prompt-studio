import type { ExtensionContextBase } from "@pstdio/sdk/extensions";
import { workspaceEventSessionPages } from "./attempt-queries";
import { readAttempt } from "./attempt-storage";
import { autoBuildDispatchPages } from "./auto-build-dispatches";

// Run membership follows explicit dispatch and conversation links, never all project sessions.
export async function readAutoBuildOwnership(ctx: Pick<ExtensionContextBase, "storage">, supervisorId?: string) {
  const sessionIds = new Set(supervisorId ? [supervisorId] : []);
  const workspaceIds = new Set<string>();
  if (!supervisorId) return { sessionIds, workspaceIds };
  for await (const dispatches of autoBuildDispatchPages(ctx, supervisorId)) {
    for (const { workspaceId } of dispatches) {
      workspaceIds.add(workspaceId);
      const attempt = await readAttempt(ctx.storage, workspaceId);
      if (!attempt) continue;
      sessionIds.add(attempt.implementationSessionId);
      const reviews = attempt.revisions.flatMap((revision) => revision.reviews);
      for (const review of reviews) if (review.sessionId) sessionIds.add(review.sessionId);
    }
    for await (const ids of workspaceEventSessionPages(
      ctx.storage,
      dispatches.map(({ workspaceId }) => workspaceId),
    )) {
      for (const id of ids) sessionIds.add(id);
    }
  }
  return { sessionIds, workspaceIds };
}

export { readPendingAutoBuildRequests } from "./auto-build-request-page";
