// The checked mapping artifact for the PS-321 contribution-id rename pass. The 0029
// migration's UPDATE statements, its test, and the first-party source renames all
// follow this map. Keys are the old durable values, values are the new ones.

const plannerCommand = (localId: string) => `pstdio.pstdio-planner.command.${localId}`;
const devCommand = (localId: string) => `pstdio.pstdio-dev.command.${localId}`;

export const renamedCommandIds: Record<string, string> = {
  [plannerCommand("ticketStatus.read")]: plannerCommand("ticket-status.read"),
  [plannerCommand("ticketStatus.create")]: plannerCommand("ticket-status.create"),
  [plannerCommand("ticketStatus.update")]: plannerCommand("ticket-status.update"),
  [plannerCommand("ticketStatus.delete")]: plannerCommand("ticket-status.delete"),
  [plannerCommand("ticketStatus.setDefault")]: plannerCommand("ticket-status.set-default"),
  [plannerCommand("ticketStatus.reorder")]: plannerCommand("ticket-status.reorder"),
  [plannerCommand("ticketTag.read")]: plannerCommand("ticket-tag.read"),
  [plannerCommand("ticketTag.create")]: plannerCommand("ticket-tag.create"),
  [plannerCommand("ticketTag.update")]: plannerCommand("ticket-tag.update"),
  [plannerCommand("ticketTag.delete")]: plannerCommand("ticket-tag.delete"),
  [plannerCommand("ticketTag.createOption")]: plannerCommand("ticket-tag.create-option"),
  [plannerCommand("ticketTag.updateOption")]: plannerCommand("ticket-tag.update-option"),
  [plannerCommand("ticketTag.deleteOption")]: plannerCommand("ticket-tag.delete-option"),
  [plannerCommand("ticketTag.applyDraft")]: plannerCommand("ticket-tag.apply-draft"),
  [plannerCommand("runReview")]: plannerCommand("run-review"),
  [devCommand("issues.discoverHighImpact")]: devCommand("issues.discover-high-impact"),
  [devCommand("workspace.openInVscode")]: devCommand("workspace.open-in-vscode"),
  [devCommand("workspace.openInIsolation")]: devCommand("workspace.open-in-isolation"),
  [devCommand("workspace.stopIsolation")]: devCommand("workspace.stop-isolation"),
};

export const renamedScheduleIds: Record<string, string> = {
  "pstdio.pstdio-dev.schedule.dailyIssueDiscovery": "pstdio.pstdio-dev.schedule.daily-issue-discovery",
  "pstdio.pstdio-planner-loops.schedule.refineTickets": "pstdio.pstdio-planner-loops.schedule.refine-tickets",
  "pstdio.pstdio-planner-loops.schedule.implementTickets": "pstdio.pstdio-planner-loops.schedule.implement-tickets",
  "pstdio.pstdio-planner-loops.schedule.stuckWorkSweep": "pstdio.pstdio-planner-loops.schedule.stuck-work-sweep",
  "pstdio.pstdio-planner-loops.schedule.reviewTickets": "pstdio.pstdio-planner-loops.schedule.review-tickets",
};

export const renamedSkillKeys: Record<string, string> = {
  create_proposal: "create-proposal",
  create_sub_tickets: "create-sub-tickets",
  create_ticket: "create-ticket",
  implement_ticket: "implement-ticket",
  refine_ticket: "refine-ticket",
  use_reports: "use-reports",
  create_pstdio_extension: "create-pstdio-extension",
  labResource: "lab-resource",
  fontEditor: "font-editor",
};
