import { defineCommand, l10n, params, type ResourceAnchor } from "@pstdio/sdk/extensions";
import { actorFromSource } from "../data/attempt-actors";
import { appendAttemptEvent, launchClaimsCollection, putAttempt } from "../data/attempt-storage";
import type { AttemptLaunchClaim, AttemptRecord, HumanRequestReason } from "../data/attempt-types";
import { moveTicketToInProgress } from "../data/move-to-in-progress";
import { findTicket } from "../data/resolve";
import { loadAttemptReadiness } from "./attempt-readiness";
import { requestHuman } from "./human-requests";
import {
  createAnchoredWorkspace,
  harnessInput,
  resolveTicket,
  resolveTicketIdentity,
  ticketActionParams,
  workspaceModeParam,
} from "./ticket-actions";

const humanReadinessReasons = new Set<HumanRequestReason>([
  "ambiguous-dependency-attempt",
  "divergent-dependency-attempts",
  "dependency-cycle",
  "dependency-missing",
]);

export const runAttemptCommand = defineCommand({
  title: "Run attempt",
  cli: { examples: ["pst pstdio-planner run-attempt --ticket PS-1"] },
  menus: [
    {
      slot: "ticket.headerOverflow",
      label: l10n("kanbanRenderers.tickets.rowActions.runAttempt", "Run attempt"),
      icon: "play",
    },
  ],
  params: {
    ...ticketActionParams,
    repo: params.repo({ label: "Workspace" }),
    mode: workspaceModeParam,
    expectedBaseWorkspaceId: params.text({ label: "Expected base workspace", required: false }),
    expectedBaseHeadSha: params.text({ label: "Expected base commit", required: false }),
  },
  async run(ctx) {
    const { agent } = ctx.params;
    const ticketRef = resolveTicket(ctx);
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
      return { decision: "wait" as const, reason: "launch-claimed" as const, dependencyIds: [] };
    }

    try {
      const { readiness } = await loadAttemptReadiness(ctx, ticketRef);
      if (readiness.decision === "wait") {
        const storedTicket = await findTicket(ctx.storage, ticketRef);
        if (storedTicket?.statusId && humanReadinessReasons.has(readiness.reason as HumanRequestReason)) {
          await requestHuman(ctx, {
            ticket: storedTicket.id,
            reason: readiness.reason as HumanRequestReason,
            question: `${storedTicket.shorthand} cannot start because ${readiness.reason}. Dependencies: ${readiness.dependencyIds.join(", ") || "none"}.`,
            expectedAction:
              "Repair the dependency graph or select the intended dependency attempt, then resolve this request.",
            expectedTicketStatusId: storedTicket.statusId,
          });
        }
        return readiness;
      }
      if (
        (ctx.params.expectedBaseWorkspaceId !== undefined &&
          ctx.params.expectedBaseWorkspaceId !== (readiness.baseWorkspaceId ?? "")) ||
        (ctx.params.expectedBaseHeadSha !== undefined && ctx.params.expectedBaseHeadSha !== readiness.baseHeadSha)
      ) {
        return { decision: "wait" as const, reason: "stale-base" as const, dependencyIds: [] };
      }

      const { anchor, mode, ticket, workspace } = await createAnchoredWorkspace(ctx, readiness.baseHeadSha);
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
        template: "implement-ticket",
        vars: { ticket: anchor.label ?? ticketIdentity.shorthand, workspaceId: workspace.id },
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
