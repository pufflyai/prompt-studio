// Launch a gate review that checks project dependencies and updates the saved plan.
import {
  type CommandContext,
  defineCommand,
  params,
  type ResourceAnchor,
  sessionBrowser,
} from "@pstdio/sdk/extensions";
import { isLiveSession } from "../../commands/auto-build-sessions";
import { findTicket } from "../../data/resolve";
import { readWorkflowStatuses, usableWorkflowStatuses } from "../../data/workflow-statuses";
import type { PlanRow } from "../contracts";
import { plannerExtensionId } from "../planner";
import { gateLaunches, registerGate, releaseRefusedGateLaunch } from "./gate-store";

function reviewPrompt(row: Pick<PlanRow, "id" | "shorthand" | "title" | "instructions">) {
  return [
    `Review the agent gate ${row.shorthand}: ${row.title}, then update the plan in accordance with its instructions.`,
    `Gate instructions:\n${row.instructions}`,
    "Read the current gate ticket, the full project plan, and the linked tickets before making changes. Review dependencies in both directions, parent and child tickets, milestones, dates, blockers, and the order of work. Check for missing prerequisites, cycles, stale or unnecessary work, and whether the plan reaches the gate's intended outcome.",
    "Use the findings to update the plan and relevant Planner tickets. Add or refine work when needed, correct dependencies and milestone placement, and preserve unrelated work. Explain the changes and their evidence on the gate ticket. If the gate cannot be satisfied yet, keep it open and identify the missing work. Mark it done only after verifying the outcome. Follow the project's instructions and any explicit approval requirements.",
    `Ticket ID: ${row.id}`,
    "Read the timeline with: pst pstdio.planner timeline plan read",
    `Read the gate with: pst pstdio.planner get-ticket --id ${row.shorthand}`,
    "Use pst pstdio.planner and pst pstdio.planner timeline commands to save changes. Run their --help for supported operations.",
  ].join("\n\n");
}

export class GateLaunchUnconfirmed extends Error {
  constructor() {
    super("The review launch is unconfirmed. Check for its session before launching again.");
  }
}

class GateLaunchRefused extends Error {
  constructor(reason: unknown) {
    super(reason instanceof Error ? reason.message : String(reason), { cause: reason });
    this.name = "GateLaunchRefused";
  }
}

const launchAnchor = (ctx: CommandContext, ticket: string, attempt: string): ResourceAnchor => ({
  type: "planner-gate-launch",
  id: `${ticket}:${attempt}`,
  extensionId: plannerExtensionId,
  projectId: ctx.projectId,
  role: "context",
});

async function readGateLaunch(ctx: CommandContext, ticket: string, attempt: string) {
  const { items } = await ctx.sessions.query({
    anchor: launchAnchor(ctx, ticket, attempt),
    includeArchived: true,
    limit: 1,
  });
  return items[0];
}

function openGateReview(ctx: CommandContext, session: { id: string; title: string }) {
  ctx.navigation.open({
    kind: "panel",
    panel: sessionBrowser.panels.conversation,
    open: "preview",
    resource: { type: "session", id: session.id, extensionId: "pstdio", label: session.title },
  });
}

async function requireOpenGate(ctx: CommandContext, ticket: string) {
  const row = await findTicket(ctx, ticket);
  if (!row || row.archived) throw new GateLaunchRefused("Unknown ticket.");
  const workflow = usableWorkflowStatuses(await readWorkflowStatuses(ctx));
  if (workflow.completedStatusIds.includes(row.statusId ?? "")) throw new GateLaunchRefused("This gate is complete.");
  return row;
}

export const checkGateLaunchCommand = defineCommand({
  id: "timeline.gate.check-launch",
  title: "Check gate review launch",
  cli: { description: "Check whether an agent gate already launched its review session." },
  params: { ticket: params.text({ required: true }), attemptId: params.text() },
  async run(ctx, { ticket, attemptId }) {
    const row = await findTicket(ctx, ticket);
    if (!row || row.archived) throw new Error("Unknown ticket.");
    const launchId = attemptId ?? (await gateLaunches(ctx).get(row.id))?.launchId;
    if (!launchId) return { status: "ready" as const };
    const session = await readGateLaunch(ctx, row.id, launchId);
    if (!session) return { status: "unconfirmed" as const };
    openGateReview(ctx, session);
    return { status: "confirmed" as const, launchId, session };
  },
});

export const launchGateCommand = defineCommand({
  id: "timeline.gate.launch",
  title: "Review agent gate",
  cli: { description: "Mark a ticket as an agent gate and launch its planning review." },
  mutating: true,
  params: {
    ticket: params.text({ required: true }),
    after: params.text({ description: "Confirmed session ID to replace after its review has ended." }),
    attemptId: params.text(),
  },
  async run(ctx, { ticket, after, attemptId }) {
    const row = await requireOpenGate(ctx, ticket);
    const launches = gateLaunches(ctx);
    const current = await launches.read(row.id);
    if (current) {
      const session = await readGateLaunch(ctx, row.id, current.value.launchId).catch(() => {
        throw new GateLaunchUnconfirmed();
      });
      if (!session) throw new GateLaunchUnconfirmed();
      if (after !== session.id || isLiveSession(session) || attemptId === current.value.launchId) {
        openGateReview(ctx, session);
        return { ...session, type: "session" as const };
      }
      const prior = attemptId && (await readGateLaunch(ctx, row.id, attemptId));
      if (prior) {
        openGateReview(ctx, prior);
        return { ...prior, type: "session" as const };
      }
    } else if (after) {
      throw new GateLaunchRefused("The preceding gate review could not be found.");
    }
    if (!(await ctx.workspaces.getDefault()))
      throw new GateLaunchRefused("Attach a workspace before starting a session.");
    await registerGate(ctx, row.id).catch((error: unknown) => {
      throw new GateLaunchRefused(error);
    });
    const launch = { launchId: attemptId ?? ctx.storage.ids.create() };
    const reserved = current
      ? await launches.updateIfUnchanged(row.id, current.revision, launch)
      : await launches.createIfAbsent(row.id, launch);
    if (!reserved) throw new GateLaunchUnconfirmed();
    try {
      const session = await ctx.sessions.create({
        title: `Review gate: ${row.shorthand}`,
        prompt: reviewPrompt({ ...row, instructions: row.content }),
        anchors: [
          {
            type: "ticket",
            id: row.id,
            extensionId: plannerExtensionId,
            projectId: ctx.projectId,
            shorthand: row.shorthand,
            label: `${row.shorthand} ${row.title}`,
            role: "primary",
          },
          launchAnchor(ctx, row.id, launch.launchId),
        ],
      });
      openGateReview(ctx, session);
      return session;
    } catch (error) {
      if (
        error instanceof Error &&
        error.name === "SessionCreateRefused" &&
        (await releaseRefusedGateLaunch(ctx, row.id, launch, current?.value))
      )
        throw new GateLaunchRefused(error);
      ctx.logger.warn("Gate review launch could not be confirmed", { ticketId: row.id, error: String(error) });
      throw new GateLaunchUnconfirmed();
    }
  },
});
