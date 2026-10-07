// Launch a ticket-linked agent prompt to help the person complete their pending actions.
import { defineCommand, params, workbenchPanels } from "@pstdio/sdk/extensions";
import type { PlanRow } from "../contracts";
import { plannerExtensionId } from "../planner";
import { readPlanCommand } from "./read-plan";

function actionPrompt(row: PlanRow) {
  const pending = row.actions.filter((action) => !action.resolution && !action.cancellation);
  return [
    `Help me resolve the human action required for ${row.shorthand}: ${row.title}.`,
    "Read the current ticket and its linked context before acting. Explain what I need to do and help me complete it. Ask me for any missing decisions or confirmations. Follow the ticket's approval and access requirements. Do not request secret values in chat.",
    "Launching this prompt does not resolve an action or complete the ticket. Record an action response only after I supply the decision or confirm completion. Verify the result before changing the ticket's workflow status or Human Needed flag.",
    `Ticket ID: ${row.id}`,
    row.blockedReason ? `Reason:\n${row.blockedReason}` : "",
    row.instructions ? `Ticket instructions:\n${row.instructions}` : "",
    pending.length ? `Pending actions (including question and choice IDs):\n${JSON.stringify(pending, null, 2)}` : "",
    row.actionErrors.length ? `Action data errors to investigate:\n${row.actionErrors.join("\n")}` : "",
    `Read current requests with: pst ticket-timeline action read --ticket ${row.shorthand}`,
    'For a structured action, save the confirmed response with pst ticket-timeline action resolve --ticket <ticket> --action-id <id> --expected-revision <revision> --response <JSON>. Task responses use {"confirmed":true}; decisions use {"answers":{<question-id>:<answer>}}.',
  ]
    .filter(Boolean)
    .join("\n\n");
}

export const launchActionCommand = defineCommand({
  id: "action.launch",
  title: "Resolve action",
  cli: { description: "Launch a ticket-linked prompt to resolve pending human actions." },
  params: { ticket: params.text({ required: true }) },
  async run(ctx, input) {
    const plan = await readPlanCommand.run(ctx, {});
    const row = plan.sections
      .flatMap(({ rows }) => rows)
      .find(({ id, shorthand }) => id === input.ticket || shorthand.toLowerCase() === input.ticket.toLowerCase());

    if (!row) {
      throw new Error(`Unknown ticket "${input.ticket}".`);
    }

    if (row.state !== "await-input") {
      throw new Error("This ticket no longer needs human action. Reload the timeline.");
    }

    const session = await ctx.sessions.create({
      title: `Resolve action: ${row.shorthand}`,
      prompt: actionPrompt(row),
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
