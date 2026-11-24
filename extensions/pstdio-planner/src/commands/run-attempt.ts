import {
  type CommandContext,
  defineCommand,
  l10n,
  type ParamsOf,
  params,
  type ResourceAnchor,
} from "@pstdio/sdk/extensions";
import { actorFromSource } from "../data/attempt-actors";
import { legacyAttemptOutput } from "../data/attempt-compatibility";
import { attemptId, selectedAttemptId } from "../data/attempt-identity";
import { readTicketAttempts } from "../data/attempt-queries";
import { readRetiredWorkspaceIds } from "../data/attempt-retirement";
import { appendAttemptEvent, attemptSelectionsCollection, putAttempt } from "../data/attempt-storage";
import type { AttemptRecord } from "../data/attempt-types";
import { attemptWaitMessage } from "../data/attempt-wait-message";
import { findTicket } from "../data/resolve";
import { createReviewRequest, handoffRequest } from "../data/review-request-create";
import type { ReviewRequestReason } from "../data/review-request-types";
import { withWriteGuard } from "../data/write-guard";
import { ticketMenuSlots } from "../resource-kinds";
import { attemptPrompt } from "./attempt-prompt";
import { loadAttemptReadiness, readImplementationCapacity } from "./attempt-readiness";
import { adoptDraftWorkspace } from "./attempt-workspace";
import { WorkspaceUnavailableError, workspaceHead } from "./change-requests";
import { prepareDependencyBase } from "./dependency-base";
import { prepareManualRecovery } from "./manual-workspace-recovery";
import { repairAttempt } from "./repair-attempt";
import {
  createAnchoredWorkspace,
  harnessInput,
  resolveTicket,
  resolveTicketIdentity,
  ticketActionParams,
} from "./ticket-actions";
import { finishWorkspaceRecovery, recoverySessionInput, type WorkspaceRecovery } from "./workspace-recovery";

const reviewReadinessReasons = new Set<ReviewRequestReason>([
  "ambiguous-dependency-attempt",
  "dependency-cycle",
  "dependency-missing",
]);

class AttemptLaunchRefused extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AttemptLaunchRefused";
  }
}

const runAttemptParams = {
  ...ticketActionParams,
  newVariant: params.boolean({
    label: "Explore another implementation variant",
    description:
      "Start a separate workspace and conversation to try a different solution for this ticket. Leave this off to resume the existing variant when one is available.",
  }),
  workspace: params.workspace({ label: "Workspace", providers: ["pstdio.worktree"] }),
};

const reuseAttempt = async (
  ctx: CommandContext,
  ticketIdentity: { id: string; shorthand: string },
  commandParams: ParamsOf<typeof runAttemptParams>,
  options: StartAttemptOptions,
) => {
  const [attempts, selection] = await Promise.all([
    readTicketAttempts(ctx.storage, [ticketIdentity.id]),
    attemptSelectionsCollection(ctx.storage).get(ticketIdentity.id),
  ]);
  const retired = await readRetiredWorkspaceIds(ctx.storage, attempts.map(attemptId));
  const variants = attempts.filter(
    (attempt) => attempt.ticketId === ticketIdentity.id && !retired.has(attemptId(attempt)),
  );
  const chosen = selection
    ? variants.filter((attempt) => attemptId(attempt) === selectedAttemptId(selection))
    : variants;
  if (variants.length && chosen.length !== 1)
    throw new AttemptLaunchRefused("Select the implementation variant to resume, or explicitly request a new variant.");
  const existing = chosen[0];
  if (existing) {
    await options.beforeDispatch?.();
    let headSha: string | null;
    try {
      headSha = existing.base === null ? null : await workspaceHead(ctx, existing.workspaceId);
    } catch (error) {
      if (!(error instanceof WorkspaceUnavailableError) || !options.manualResume) throw error;
      const base = commandParams.workspace?.params?.base;
      const recovery = await prepareManualRecovery(
        ctx,
        existing,
        typeof base === "string" ? base : undefined,
        options.beforeDispatch,
      );
      return launchAttempt(
        ctx,
        { ...commandParams, workspace: { providerId: "pstdio.worktree", params: { base: recovery.base } } },
        recovery.options,
      );
    }
    const session = await ctx.sessions.get(existing.implementationSessionId);
    const capacity = await readImplementationCapacity(ctx);
    if (
      !session ||
      (!["queued", "in_progress", "awaiting_input"].includes(session.status ?? "") &&
        capacity.running >= capacity.limit)
    )
      throw new AttemptLaunchRefused("No implementation capacity is available to resume this owner.");
    await repairAttempt(ctx, {
      workspaceId: attemptId(existing),
      expectedHeadSha: headSha,
      reason: `Continue implementation of ${existing.ticketShorthand} as requested. Reuse this workspace and conversation.`,
    });
    const workspace = (await ctx.workspaces.get(existing.workspaceId))!;
    return {
      decision: "started" as const,
      mode: "existing",
      ticket: ticketIdentity,
      workspace,
      attempt: await legacyAttemptOutput(ctx.storage, existing),
      variant: existing,
      session: { ...session, workspace_id: workspace.id },
    };
  }
  return null;
};
interface StartAttemptOptions {
  manualResume?: boolean;
  beforeDispatch?: (baseHeadSha?: string) => Promise<void>;
  beforeSessionStart?: (workspaceId: string) => Promise<void>;
  requireMergedDependencies?: boolean;
  workspaceId?: string;
  recovery?: WorkspaceRecovery;
}

export async function startAttempt(
  ctx: CommandContext,
  commandParams: ParamsOf<typeof runAttemptParams>,
  options: StartAttemptOptions = {},
) {
  // Corrections continue in the owned workspace and conversation. Recovery and draft adoption bring their own workspace.
  const startsFresh = commandParams.newVariant || options.workspaceId || options.recovery;
  const ticketIdentity = await resolveTicketIdentity(ctx, resolveTicket(ctx, commandParams));
  const reused = startsFresh ? null : await reuseAttempt(ctx, ticketIdentity, commandParams, options);
  return reused ?? launchAttempt(ctx, commandParams, options);
}

async function launchAttempt(
  ctx: CommandContext,
  commandParams: ParamsOf<typeof runAttemptParams>,
  options: StartAttemptOptions,
) {
  const { agent } = commandParams;
  const chosenBase = commandParams.workspace?.params?.base;
  const ticketRef = resolveTicket(ctx, commandParams);
  const ticketIdentity = await resolveTicketIdentity(ctx, ticketRef);
  const ownerRunId = ctx.invocationId ?? crypto.randomUUID();
  const { readiness, capacity } = await loadAttemptReadiness(ctx, ticketRef, {
    base: typeof chosenBase === "string" ? chosenBase : undefined,
    requireMergedDependencies: options.requireMergedDependencies,
  }).catch((error: unknown) => {
    throw new AttemptLaunchRefused(error instanceof Error ? error.message : String(error));
  });
  if (readiness.decision === "wait") {
    const message = attemptWaitMessage(ticketIdentity.shorthand, readiness, capacity);
    const storedTicket = await findTicket(ctx, ticketRef);
    if (storedTicket?.statusId && reviewReadinessReasons.has(readiness.reason as ReviewRequestReason)) {
      // The readiness reason is what the person who started the attempt needs, so a
      // failed handoff must not replace it.
      await createReviewRequest(ctx, {
        ticket: storedTicket.id,
        reason: readiness.reason as ReviewRequestReason,
        title: message,
        request: handoffRequest,
        instructions:
          "Repair the dependency graph or select the intended dependency attempt, then answer this request.",
        expectedTicketStatusId: storedTicket.statusId,
      }).catch((error: unknown) =>
        ctx.logger.warn("Could not request review input for a ticket that cannot start", {
          ticket: storedTicket.shorthand,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    }
    throw new AttemptLaunchRefused(message);
  }
  const dependencyBase = readiness.mode === "folder" ? null : await prepareDependencyBase(ctx, readiness);
  const startingHead = options.recovery?.headSha ?? dependencyBase?.headSha ?? null;
  const beforeDispatch = async () => options.beforeDispatch?.(readiness.baseHeadSha ?? undefined);
  const { anchor, mode, ticket, workspace, headSha } = options.workspaceId
    ? await adoptDraftWorkspace(ctx, ticketRef, options.workspaceId, beforeDispatch)
    : {
        ...(await createAnchoredWorkspace(ctx, commandParams, startingHead, beforeDispatch)),
        headSha: startingHead,
      };
  const id = headSha === null ? ctx.storage.ids.create() : workspace.id;
  const attemptAnchor: ResourceAnchor = {
    type: "planner-attempt",
    id,
    label: headSha === null ? anchor.label : (workspace.workspace_shorthand ?? anchor.label),
    metadata: {
      ticketId: ticket.id,
      workspaceId: workspace.id,
      phase: "implementation",
      revision: null,
      headSha: null,
    },
  };
  const sessionInput = {
    title: `Implement ticket: ${anchor.label}`,
    workspaceId: workspace.id,
    anchors: [anchor, attemptAnchor],
    ...harnessInput(agent),
    prompt: await attemptPrompt(ctx, {
      ticket: anchor.label ?? ticketIdentity.shorthand,
      workspaceId: workspace.id,
      id,
      dependencyBase,
      recovery: options.recovery,
      adopted: Boolean(options.workspaceId),
      chosenBase: typeof chosenBase === "string" ? chosenBase : undefined,
      headSha,
      readiness,
    }),
    ...(await recoverySessionInput(ctx, options.recovery, beforeDispatch)),
  };
  await options.beforeSessionStart?.(workspace.id);
  const session = await ctx.sessions.create(sessionInput);
  const timestamp = new Date().toISOString();
  const attempt: AttemptRecord = {
    schemaVersion: 2,
    ...(headSha === null ? { id } : {}),
    workspaceId: workspace.id,
    workspaceShorthand: workspace.workspace_shorthand ?? workspace.id,
    ticketId: ticket.id,
    ticketShorthand: anchor.label ?? ticketIdentity.shorthand,
    implementationSessionId: session.id,
    base: dependencyBase,
    revisions: [],
    implementationDisconnectRetries: 0,
    reviewDisconnectRetries: 0,
    blocker: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  await putAttempt(ctx.storage, attempt);
  if (options.recovery) await finishWorkspaceRecovery(ctx, options.recovery.previous, attempt);
  await appendAttemptEvent(ctx.storage, {
    attemptId: id,
    workspaceId: workspace.id,
    revision: null,
    type: "attempt_started",
    actor: actorFromSource(ctx.source, ownerRunId),
    sessionId: session.id,
    reportId: null,
    reviewId: null,
    threadId: null,
    commitSha: headSha,
    metadata: {
      mode: readiness.mode,
      dependencyAttemptIds: readiness.dependencyAttemptIds,
      ...(options.recovery ? { recoveredFromWorkspaceId: options.recovery.previous.workspaceId } : {}),
    },
  });
  return {
    decision: "started" as const,
    mode,
    ticket,
    workspace,
    attempt: await legacyAttemptOutput(ctx.storage, attempt),
    variant: attempt,
    session: { ...session, workspace_id: workspace.id },
  };
}

export const runAttemptCommand = defineCommand({
  id: "run-attempt",
  title: "Run attempt",
  mutating: true,
  cli: { examples: ["pst pstdio.planner run-attempt --ticket PS-1"] },
  menus: [
    {
      slot: ticketMenuSlots.headerOverflow,
      label: l10n("kanbanRenderers.tickets.rowActions.runAttempt", "Run attempt"),
      icon: "play",
    },
  ],
  params: runAttemptParams,
  async run(ctx, commandParams) {
    const manualResume = !["automation", "schedule", "event"].includes(ctx.source ?? "");
    return withWriteGuard(
      ctx,
      "attempt-launch",
      () => startAttempt(ctx, commandParams, { manualResume }),
      () => {
        throw new AttemptLaunchRefused("Another Planner write is running. Retry when it finishes.");
      },
    );
  },
});
