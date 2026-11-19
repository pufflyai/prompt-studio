import type { ExtensionContextBase } from "@pstdio/sdk/extensions";
import { attemptEventsCollection, readAttempt } from "./attempt-storage";
import { autoBuildDispatches } from "./auto-build-dispatches";
import { readTicketReviewRequests } from "./review-request-storage";
import type { ReviewRequest, ReviewRequestView } from "./review-request-types";

// Run membership follows explicit dispatch and conversation links, never all project sessions.
export async function readAutoBuildOwnership(ctx: Pick<ExtensionContextBase, "storage">, supervisorId?: string) {
  const sessionIds = new Set(supervisorId ? [supervisorId] : []);
  const dispatches = supervisorId ? await autoBuildDispatches(ctx, supervisorId).list() : [];
  const attemptIds = new Set(dispatches.map(({ attemptId, workspaceId }) => attemptId ?? workspaceId));
  for (const id of attemptIds) {
    const attempt = await readAttempt(ctx.storage, id);
    if (!attempt) continue;
    sessionIds.add(attempt.implementationSessionId);
    const reviews = attempt.revisions.flatMap((revision) => revision.reviews);
    for (const review of reviews) if (review.sessionId) sessionIds.add(review.sessionId);
  }
  if (attemptIds.size) {
    for (const event of await attemptEventsCollection(ctx.storage).list()) {
      if (attemptIds.has(event.attemptId ?? event.workspaceId) && event.sessionId) sessionIds.add(event.sessionId);
    }
  }
  return { sessionIds, attemptIds };
}

export function linkedAutoBuildRequests<T extends ReviewRequest>(
  requests: T[],
  ownership: { sessionIds: ReadonlySet<string>; attemptIds: ReadonlySet<string> },
) {
  const sessions = new Set(ownership.sessionIds);
  const linked = new Map<string, T>();
  let changed = true;
  while (changed) {
    changed = false;
    for (const request of requests) {
      const context = request.context;
      if (
        linked.has(request.id) ||
        !(
          ownership.attemptIds.has(context.attemptId ?? context.workspaceId ?? "") ||
          sessions.has(context.relatedSessionId ?? "") ||
          sessions.has(context.sessionId ?? "")
        )
      )
        continue;
      linked.set(request.id, request);
      if (context.sessionId) sessions.add(context.sessionId);
      changed = true;
    }
  }
  return [...linked.values()];
}

export async function readPendingAutoBuildRequests(
  ctx: Pick<ExtensionContextBase, "storage">,
  supervisorId: string | undefined,
  scoped: ReviewRequestView[] = [],
) {
  const requests = new Map(scoped.map((request) => [request.id, request]));
  if (supervisorId) {
    const ownership = await readAutoBuildOwnership(ctx, supervisorId);
    const groups = await readTicketReviewRequests(ctx.storage);
    const all = [...groups.values()].flatMap(({ requests }) => requests);
    for (const request of linkedAutoBuildRequests(all, ownership)) {
      if (request.state === "open") requests.set(request.id, request);
    }
  }
  return [...requests.values()].sort((a, b) => a.requestedAt.localeCompare(b.requestedAt));
}
