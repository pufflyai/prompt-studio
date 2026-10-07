// Launch a gate review that checks project dependencies and updates the saved plan.
import { defineCommand, params, workbenchPanels } from "@pstdio/sdk/extensions";
import type { PlanRow } from "../contracts";
import { plannerExtensionId } from "../planner";
import { readPlanCommand } from "./read-plan";

function reviewPrompt(row: PlanRow) {
  return [
    `Review the agent gate ${row.shorthand}: ${row.title}, then update the plan in accordance with its instructions.`,
    `Gate instructions:\n${row.instructions}`,
    "Read the current gate ticket, the full project plan, and the linked tickets and artifacts before making changes. Review dependencies in both directions, parent and child tickets, milestones, dates, blockers, and the order of work. Check for missing prerequisites, cycles, stale or unnecessary work, and whether the plan reaches the gate's intended outcome.",
    "Use the findings to update the plan and relevant Planner tickets. Add or refine work when needed, correct dependencies and milestone placement, and preserve unrelated work. Explain the changes and their evidence on the gate ticket. If the gate cannot be satisfied yet, keep it open and identify the missing work. Mark it done only after verifying the outcome. Follow the project's instructions and any explicit approval requirements.",
    `Ticket ID: ${row.id}`,
    "Read the timeline with: pst ticket-timeline plan read",
    `Read the gate with: pst tickets panel --id ${row.shorthand}`,
    "Use pst tickets and pst ticket-timeline commands to save changes. Run their --help for supported operations. Published prototypes are available through pst pstdio-artifacts list/read.",
  ].join("\n\n");
}

export const launchGateCommand = defineCommand({
  id: "gate.launch",
  title: "Review agent gate",
  cli: { description: "Launch an agent to review a gate and update project planning." },
  params: { ticket: params.text({ required: true }) },
  async run(ctx, { ticket }) {
    const plan = await readPlanCommand.run(ctx, {});
    const row = plan.sections
      .flatMap(({ rows }) => rows)
      .find(({ id, shorthand }) => id === ticket || shorthand.toLowerCase() === ticket.toLowerCase());
    if (!row?.gate) {
      throw new Error("This ticket is not an agent gate.");
    }
    if (row.done) {
      throw new Error("This gate is complete.");
    }
    const session = await ctx.sessions.create({
      title: `Review gate: ${row.shorthand}`,
      prompt: reviewPrompt(row),
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
      ],
    });
    ctx.navigation.open({
      kind: "panel",
      panel: workbenchPanels.projectSession,
      open: "preview",
      resource: { type: "session", id: session.id, extensionId: "pstdio", label: session.title },
    });
    return session;
  },
});
