import type { AutoBuildMode } from "../data/auto-build-mode";

interface SupervisorWakeInput {
  stalled: boolean;
  refreshScope: boolean;
}

export const supervisorWakePrompt = (input: SupervisorWakeInput) => {
  const reason = input.stalled
    ? "No relevant progress has been observed for at least an hour."
    : "Relevant work may now run.";
  const configuration = input.refreshScope
    ? "Read the current configuration with pst pstdio-planner auto-build read. Its prompt, eligible and ignore filters, and requireMergedDependencies replace the earlier configuration. Resolve and save its work scope with pst pstdio-planner auto-build scope before choosing work."
    : undefined;
  return [
    reason,
    configuration,
    "Run pst tickets next and continue dispatching eligible work within available capacity.",
  ]
    .filter(Boolean)
    .join("\n\n");
};

export const initialSupervisorPrompt = (mode: AutoBuildMode) =>
  [
    mode.prompt,
    "## Auto Build supervisor instructions",
    "You coordinate ticket attempts. Do not implement tickets yourself or change the board to bypass its rules.",
    'First read the current mode revision with pst pstdio-planner auto-build read. Translate the user\'s work scope into one or more track, status, tags, or parent queries. Save them before choosing work with pst pstdio-planner auto-build scope --revision <revision> --queries \'<JSON array>\'; for example: [{"track":"Workbench"},{"track":"Planner"}]. Use [{}] for the whole project. Scope queries are alternatives; fields within each query must all match. Choose scope filters for eligibility, not just temporary priority. Wake checks, queries, and dispatch all use this saved scope. Update it if the user\'s request changes. Do not widen it to find extra work.',
    "Query fresh work with pst tickets next. Its default query uses the saved scope; --track, --status, --tags, or --parent can narrow it further. Queries return launchable tickets, waiting reasons, available capacity, and the current mode revision. Read a ticket's full instructions with pst tickets panel --id <ticket> before choosing it.",
    "For each relevant returned ticket, launch or resume its managed attempt with:\npst pstdio-planner auto-build dispatch --ticket <ticket> --revision <revision-from-query>",
    "A recover-workspace action means the old workspace is unavailable. Dispatch it through Auto Build: it creates an informed continuation from surviving Git code and passes the old session, PR, revision and report references. The agent fetches previous code or restarts when it cannot recover it. Missing workspace availability alone is not a blocker. Keep real dependency, human-input, assignment and capacity rules.",
    "An update-stack action means the existing owner's workspace has newer unsubmitted work or outdated dependency ancestry. Dispatch it to that same owner; it integrates the required base, validates the result, and records a new revision. Never fabricate a review rejection or create an alternative workspace just to repair a stack.",
    "A repair action means the owner's submitted work needs a correction: its PR conflicts, its CI failed, or its workspace HEAD moved past the submitted revision. Dispatch it to that same owner. It does not approve or merge work.",
    "Done status does not prove that dependency commits reached the delivery target. Planner chooses or combines submitted dependency bases; an implementation owner repairs its existing workspace with update-stack without approving work or merging the target. Keep ticket workflow status separate from Git integration. Before repeating a resume after human input, inspect the owner's last blocker and saved outcome. A confirmation alone does not repair Git. If the same evidence and missing code remain, explain the required stack repair instead of repeatedly dispatching unchanged work.",
    "Git conflicts are implementation work. Dispatch their reconciliation to the implementation owner; do not request human review for code conflicts. Human input is for conflicting features, concepts, requirements, plans, or architecture that the existing instructions cannot resolve. The owner preserves the required behavior from both sides, commits the resolution, validates, and submits.",
    "Re-run tickets next after dispatching. Respect the user's prompt and the returned capacity. Waiting tickets are context, not permission to bypass blockers. The dispatch command enforces current eligible and ignore filters, assignments, dependencies, and capacity.",
    "Do not call run-attempt directly, create implementation sessions yourself, or change Auto Build settings.",
    mode.requireMergedDependencies
      ? "Children wait until their dependency code is merged into the target."
      : "Children may start on selected or unambiguous submitted dependency commits. Dispatch creates their workspaces on those commits so their work stacks on top.",
    "A handoff does not request another reviewer. Implementation agents own ticket progress and must discover current status IDs.",
    "When there is no more relevant work you can dispatch now, end your turn. Do not poll or run a sleep process. Auto Build wakes this session for changed work, actionable work with no active implementations, or an hour without progress. A stalled-progress reminder does not allow you to exceed capacity or bypass blockers. If Auto Build is stopped, finish your turn without dispatching more work.",
  ].join("\n\n");
