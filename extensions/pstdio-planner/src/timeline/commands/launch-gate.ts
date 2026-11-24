// Launch a gate review that checks project dependencies and updates the saved plan.
import { defineCommand, params, sessionBrowser } from "@pstdio/sdk/extensions";
import { findTicket } from "../../data/resolve";
import { readWorkflowStatuses, usableWorkflowStatuses } from "../../data/workflow-statuses";
import type { PlanRow } from "../contracts";
import { plannerExtensionId } from "../planner";
import { registerGate } from "./gate-store";

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

export const launchGateCommand = defineCommand({
  id: "timeline.gate.launch",
  title: "Review agent gate",
  cli: { description: "Mark a ticket as an agent gate and launch its planning review." },
  mutating: true,
  params: { ticket: params.text({ required: true }) },
  async run(ctx, { ticket }) {
    const row = await findTicket(ctx, ticket);
    if (!row || row.archived) {
      throw new Error("Unknown ticket.");
    }
    const workflow = usableWorkflowStatuses(await readWorkflowStatuses(ctx));
    if (workflow.completedStatusIds.includes(row.statusId ?? "")) {
      throw new Error("This gate is complete.");
    }
    await registerGate(ctx, row.id);
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
      ],
    });
    ctx.navigation.open({
      kind: "panel",
      panel: sessionBrowser.panels.conversation,
      open: "preview",
      resource: { type: "session", id: session.id, extensionId: "pstdio", label: session.title },
    });
    return session;
  },
});
