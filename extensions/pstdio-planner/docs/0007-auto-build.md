# Auto Build

Auto Build assigns and resumes authorized ticket work within your chosen scope, ticket filters, prerequisite policy, and execution limit.

## Configure the run

Open **Project Timeline → Auto Build**. Enter a prompt, then set **Eligible tickets** and **Ignore tickets** with the same filters used on the ticket board. Filters can use status, title, and other ticket properties, including advanced And/Or groups. Empty eligibility includes all otherwise valid unfinished tickets. Ignore filters take precedence. Completed tickets are always excluded. Status options keep their icons, colors, and IDs across renames.

Choose completed, blocked, active, and optional merge-destination statuses in **Settings → Extensions → Prompt Studio Planner → Settings**. Each choice saves immediately through the native parameter editor. Auto Build reads that shared configuration. No label or default column assigns workflow meaning. Empty optional selections disable only their status convenience.

The Auto Build button uses Play when stopped without an error, and a colored status indicator when enabled or showing an error. Running work uses the session spinner, sleeping uses a blue moon, and completed work uses a green check. Auto Build shows success when every ticket in the resolved scope has a configured completed status. Reopening one of those tickets clears success. Session rows use their normal status icons and colors, without repeated role subtitles or status tags.

The supervisor resolves your prompt to explicit ticket IDs once. Changing the prompt or either ticket filter clears that scope so the supervisor resolves it again. Prerequisites provide context but do not grant permission to dispatch outside the scope. Changing scope, prompt, filters, or policy changes the mode revision and invalidates old dispatch requests.

**Require merged dependencies** waits for prerequisite commits verified in the selected target base, including verified squash merges. Otherwise, selected or unambiguous submitted dependency commits can supply a stack. Independent branches need validated integration before implementing the child. Ticket-specific prerequisite and branch instructions remain binding.

## Implementation and progress

The responsible implementation agent updates ticket status using current project columns. It implements, validates, performs the configured adversarial review, repairs, records revisions, and follows the task's PR and CI requirements. Submission and review do not move tickets or request another mandatory reviewer.

Eligibility filters govern new dispatch and initial scope discovery. Assigned work can finish and resume after its agent changes ticket properties. Incomplete eligibility or removed filter fields block new dispatch until corrected. Recovery and repair reuse the current workspace and conversation. Additional workspaces are optional alternatives. Planner never transfers a live branch to a competing writer because a follow-up was queued.

Capacity counts live implementation execution, including CI work after a submitted revision. The supervisor and optional reviews are separate. Ordinary live sessions prevent conflicting assignment to their ticket.

## Observe and recover

Planner coalesces relevant events and checks periodically. Unrelated tickets do not change the resolved run snapshot. The supervisor ends its turn when no authorized action remains; it does not poll. Relevant capacity, decisions, dependencies, or PR/check changes can wake it again.

Known unexpected execution loss permits one bounded recovery in the same conversation. Explicit stops remain stopped. Historical cancellation without evidence requires inspection. An unchanged extension metadata refresh preserves running workers.

Repair actions compare workspace, submitted, dependency, and PR heads. Old-head review or CI cannot establish a new head's result. A conflicting PR requires repair even when no CI exists. Unavailable evidence, active replacement work, ambiguous variants, and pending implementation decisions remain concrete blockers.

Answer implementation [review requests](0006-review-requests.md) to resume affected work. Merge-only decisions block merge or merged-prerequisite dispatch; authorized submitted stacking can continue.

## Inspect and stop

The Auto Build popover lists the supervisor and running ticket sessions. Open a conversation to inspect its work. CLI candidate observations explain the current owner, blocker, evidence, and next action.

**Stop Auto Build** prevents new prompts and dispatches. Running sessions continue. Restart preserves prompt, scope, ticket filters, and policy. Legacy runs without eligibility configuration stay stopped until configured. Auto Build does not approve, merge, or publish work.

## Agent commands

```sh
pst pstdio-planner auto-build candidates
pst pstdio-planner auto-build scope --revision <mode-revision> --ticket-ids '["<ticket-id>"]'
pst pstdio-planner auto-build dispatch --ticket PS-123 --revision <mode-revision>
```

Resolve scope once, then reread the returned revision. Dispatch rechecks current configuration, assignments, prerequisites, exact heads, and capacity immediately before acting.
