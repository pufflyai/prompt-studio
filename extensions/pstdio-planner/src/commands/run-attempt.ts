import { defineCommand, l10n, params, type ResourceAnchor } from "@pstdio/sdk/extensions";
import { actorFromSource } from "../data/attempt-actors";
import { appendAttemptEvent, launchClaimsCollection, putAttempt } from "../data/attempt-storage";
import type { AttemptLaunchClaim, AttemptRecord } from "../data/attempt-types";
import { attemptWaitMessage } from "../data/attempt-wait-message";
import { moveTicketToInProgress } from "../data/move-to-in-progress";
import { findTicket } from "../data/resolve";
import { createReviewRequest, handoffRequest } from "../data/review-request-create";
import type { HumanRequestReason } from "../data/review-request-types";
import { renderOwnedTemplate } from "../data/template-store";
import { ticketMenuSlots } from "../resource-kinds";
import { loadAttemptReadiness } from "./attempt-readiness";
import {
  createAnchoredWorkspace,
  harnessInput,
  resolveTicket,
  resolveTicketIdentity,
  ticketActionParams,
} from "./ticket-actions";

const humanReadinessReasons = new Set<HumanRequestReason>([
  "ambiguous-dependency-attempt",
  "divergent-dependency-attempts",
  "dependency-cycle",
  "dependency-missing",
]);

export const runAttemptCommand = defineCommand({
  id: "run-attempt",
  title: "Run attempt",
  cli: { examples: ["pst pstdio-planner run-attempt --ticket PS-1"] },
  menus: [
    {
      slot: ticketMenuSlots.headerOverflow,
      label: l10n("kanbanRenderers.tickets.rowActions.runAttempt", "Run attempt"),
      icon: "play",
    },
  ],
  params: {
    ...ticketActionParams,
    // Attempts review and merge Git commits, so only a Git worktree can run one.
    workspace: params.workspace({ label: "Workspace", providers: ["pstdio.worktree"] }),
  },
  async run(ctx, commandParams) {
    const { agent } = commandParams;
    const chosenBase = commandParams.workspace?.params?.base;
    const ticketRef = resolveTicket(ctx, commandParams);
    const ticketIdentity = await resolveTicketIdentity(ctx, ticketRef);
    const claims = launchClaimsCollection(ctx.storage);
    const now = new Date();
    const ownerRunId = ctx.invocationId ?? crypto.randomUUID();
    const claim: AttemptLaunchClaim = {
      ticketId: ticketIdentity.id,
      ownerRunId,
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + 5 * 60 * 1000).toISOString(),
    };
    const existing = await claims.get(ticketIdentity.id);
    if (existing && existing.expiresAt <= now.toISOString()) {
      await claims.deleteIfValue(ticketIdentity.id, existing);
    }
    if (!(await claims.createIfAbsent(ticketIdentity.id, claim))) {
      throw new Error(`An attempt for ${ticketIdentity.shorthand} is already starting. Try again in a moment.`);
    }

    try {
      const { readiness, capacity } = await loadAttemptReadiness(ctx, ticketRef, {
        base: typeof chosenBase === "string" ? chosenBase : undefined,
      });
      if (readiness.decision === "wait") {
        const message = attemptWaitMessage(ticketIdentity.shorthand, readiness, capacity);
        const storedTicket = await findTicket(ctx.storage, ticketRef);
        if (storedTicket?.statusId && humanReadinessReasons.has(readiness.reason as HumanRequestReason)) {
          // The readiness reason is what the person who started the attempt needs, so a
          // failed handoff must not replace it.
          await createReviewRequest(ctx, {
            ticket: storedTicket.id,
            reason: readiness.reason as HumanRequestReason,
            title: message,
            request: handoffRequest,
            instructions:
              "Repair the dependency graph or select the intended dependency attempt, then answer this request.",
            expectedTicketStatusId: storedTicket.statusId,
          }).catch((error: unknown) =>
            ctx.logger.warn("Could not request human input for a ticket that cannot start", {
              ticket: storedTicket.shorthand,
              error: error instanceof Error ? error.message : String(error),
            }),
          );
        }
        throw new Error(message);
      }
      const { anchor, mode, ticket, workspace } = await createAnchoredWorkspace(
        ctx,
        commandParams,
        readiness.baseHeadSha,
      );
      const attemptAnchor: ResourceAnchor = {
        type: "planner-attempt",
        id: workspace.id,
        label: workspace.workspace_shorthand ?? anchor.label,
        metadata: {
          ticketId: ticket.id,
          workspaceId: workspace.id,
          phase: "implementation",
          revision: null,
          headSha: null,
        },
      };
      const session = await ctx.sessions.create({
        title: `Implement ticket: ${anchor.label}`,
        workspaceId: workspace.id,
        anchors: [anchor, attemptAnchor],
        ...harnessInput(agent),
        prompt: await renderOwnedTemplate(ctx, "implement-ticket", {
          ticket: anchor.label ?? ticketIdentity.shorthand,
          workspaceId: workspace.id,
        }),
      });
      const timestamp = new Date().toISOString();
      const attempt: AttemptRecord = {
        schemaVersion: 1,
        workspaceId: workspace.id,
        workspaceShorthand: workspace.workspace_shorthand ?? workspace.id,
        ticketId: ticket.id,
        ticketShorthand: anchor.label ?? ticketIdentity.shorthand,
        implementationSessionId: session.id,
        state: "implementing",
        base: { workspaceId: readiness.baseWorkspaceId, headSha: readiness.baseHeadSha },
        revisions: [],
        implementationDisconnectRetries: 0,
        reviewDisconnectRetries: 0,
        blocker: null,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      await putAttempt(ctx.storage, attempt);
      await appendAttemptEvent(ctx.storage, {
        workspaceId: workspace.id,
        revision: null,
        type: "attempt_started",
        actor: actorFromSource(ctx.source, ownerRunId),
        sessionId: session.id,
        reportId: null,
        reviewId: null,
        threadId: null,
        commitSha: readiness.baseHeadSha,
        metadata: { mode: readiness.mode, dependencyAttemptIds: readiness.dependencyAttemptIds },
      });
      await moveTicketToInProgress(ctx.storage, ticket.id);
      return {
        decision: "started" as const,
        mode,
        ticket,
        workspace,
        attempt,
        session: { ...session, workspace_id: workspace.id },
      };
    } finally {
      const owned = await claims.get(ticketIdentity.id);
      if (owned?.ownerRunId === ownerRunId) await claims.delete(ticketIdentity.id);
    }
  },
});
