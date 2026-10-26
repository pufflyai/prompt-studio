# Auto Build

Auto Build uses a supervisor to assign valid, unassigned tickets using your prompt. It sleeps between checks and resumes when more work can run.

## Start Auto Build

Open **Project Timeline** and click **Auto Build**. Enter the supervisor prompt at the top of the modal, choose its model and run options, set **Eligible tickets**, and click the primary **Auto Build** button. The information icon next to the title opens an explanation and a documentation link.

Choose **Supervisor model**, its harness, and its run options directly in the same modal, using the controls from Run attempt. The prompt, model, options, and filters save together when you start Auto Build. Cancel leaves the saved configuration unchanged. The supervisor uses the default collaboration mode. Worker sessions still use the project default agent. Pause Auto Build, choose **Stop Auto Build**, then start it again to use a different model for an existing supervisor.

Starting Auto Build immediately queues a check. The first check starts the supervisor as soon as it finds eligible work; the supervisor then queries its full scope before launching tickets. The queued startup status stays available while that check runs.

For example: “Prioritize small independent tickets for the next release. Leave design decisions for me.”

![Auto Build modal with a supervisor model, prompt, and eligible ticket filters.](../../../documentation/images/auto-build-confirmation.png)

The eligibility filter uses the same filter button, picker, and bubbles as Tickets, including status, title, other ticket properties, and And/Or groups. Status options keep their icons, colors, and IDs across renames. Empty eligibility includes every valid unfinished ticket. Use negative conditions such as **does not contain** to exclude tickets. Tickets in a completed status are always excluded. Eligibility governs new work only: a started ticket can continue after its agent changes the ticket status. An incomplete eligible filter, or one that uses a removed field, blocks new work until you fix it.

Choose which statuses count as completed, blocked, and active, and the optional status after merge, in Planner's workflow settings. Open **Settings → Project → Extensions**, select **Project Planner**, and use its **Settings** tab. Each choice saves immediately. No status name or default column has a built-in meaning. Empty selections turn off only the matching feature.

The selected timeline view, search, and display filters only affect what you see. The supervisor uses your prompt to select its work scope. Its saved scope and eligibility filters apply to wake checks, work queries, and dispatch.

**Require merged dependencies** is off by default. While it is off, dependent tickets can start on the selected or only submitted revision of each prerequisite, without a review verdict. Planner combines their submitted commits without merging into the delivery target, and the implementing agent stacks its changes on top. If that combination conflicts, the owner reconciles the code in its assigned workspace before continuing. Turn it on to wait until prerequisite code, including verified squash merges, is in the selected target. Missing revisions, running replacement work, and ambiguous attempts still prevent a launch. Code conflicts do not create human review requests. Ask for human input only when features, concepts, requirements, plans, or architecture conflict and the existing instructions cannot resolve them.

## Saving settings

Starting a new run saves the settings and clears the old supervisor state in one storage change. Planner sends the settings-change event and queues the next check after that save succeeds. Editing settings during a run keeps its supervisor state.

## How the supervisor works

Planner checks every three minutes and also checks when tickets change or a worker session finishes. When relevant work changes and valid work can run, Planner starts or resumes the supervisor session. A new session receives your prompt and the Auto Build instructions once. Later wakes are short messages asking it to query current work. An hourly reminder explains that progress has stalled. Worker failures, freed capacity, submitted revisions, and answered requests can change the available work. The supervisor's own dispatches are already known to it. Its completion event does not wake it again.

The scheduled check exits before reading tickets or attempts when Auto Build is off. While it is on, the timer checks only attempts dispatched by the current supervisor and their tickets and worker sessions. For submitted work with an inactive owner, it also reads linked PR heads, conflicts, and CI results. New repair evidence wakes the same supervisor, and an accepted repair event prevents another wake for that evidence. It resumes a sleeping supervisor when owned work changes or sends an hourly stalled-progress reminder. It skips active supervisors and does not scan the project for new work. Project and ticket events discover new work. Planner never changes ticket status here; the implementation agent keeps it current. Dispatch history stays with its supervisor conversation, so a new conversation starts with no dispatched work.

On its first turn for a new prompt, the supervisor saves the matching track, status, tag, or parent queries with `auto-build scope`. Multiple queries combine as alternatives. Wake checks, `pst tickets next`, and dispatch then use that same scope. An explicit `next` filter can narrow it further. Jobs outside the scope do not wake the supervisor. Prerequisites outside the scope still affect whether its jobs can run. Stopping and starting Auto Build creates a new mode revision and a fresh supervisor session. The new supervisor receives the current brief and saves a fresh scope. Editing the configuration while Auto Build is enabled keeps its current supervisor; the next wake asks it to read the updated configuration and save its scope. Once the scope is current, wakes do not repeat configuration setup or the initial instructions.

The prompt carries instructions, not a candidate snapshot. Work queries return launchable tickets, waiting reasons, capacity, and the current Auto Build revision. The supervisor reads each chosen ticket's full instructions, then launches or resumes its managed attempt. It queries fresh work after dispatching and ends its turn when no relevant work can run. Dispatch rechecks readiness and the saved scope immediately before launching; a change while the supervisor is reading cannot launch an invalid job. Planner reuses the session for later wakes within the same enabled run. Checks leave unchanged work alone while relevant implementation sessions are active. Actionable work can wake an idle supervisor when no relevant implementation sessions are active. After one hour without relevant ticket, attempt, or implementation-start progress, a check can send a reminder even when capacity is full. Reminders are at least one hour apart and never bypass capacity or blockers. The three-minute schedule checks work; it does not send a message every three minutes.

Each new implementation normally uses its own managed Git workspace and the default agent. The implementing agent moves its ticket through the project's statuses and follows the task's validation, adversarial review, PR, and CI rules. Submission and review do not move tickets or ask for another mandatory reviewer. The supervisor does not consume an implementation slot. Set **Maximum in-progress tickets** in Planner Settings to control how many implementation sessions can run together.

Tickets must have ready prerequisites and available dependency revisions. Drafts, archived tickets, tickets in a blocked status or with a blocker, review gates, and open implementation review requests are not candidates. Merge-only requests block merging and merged-prerequisite dispatch, but not stacking on submitted work. A ticket already assigned to a running session is excluded. An unattended eligible ticket without a current attempt can be considered. Completed implementations already in review stay in the normal [attempt workflow](0002-attempts.md).

Dependency waiting comes from `depends_on`, rather than a second text blocker. Planner recognizes the old sentence “Complete PS-123 before implementing this dependent contract.” only when each named ticket is a linked prerequisite. Work queries derive readiness from those links. Reads ignore the duplicate text. Updating or saving the ticket removes it, and opening the project or a merge check clears any copy still stored, whatever the prerequisites' status. Multiple references separated by commas or “and” are also recognized. Other blocker wording and additional instructions remain intact. Clear an independent blocker with `pst tickets update --id PS-123 --blocked-reason ''`; the dependency links stay in place.

Implementation follows the project's Planner settings, including adversarial review and pull request creation. Auto Build does not approve or merge work.

## Inspect or stop Auto Build

While Auto Build is running, its button opens an activity popover. Click outside it or press Escape to close it. The popover shows pending review requests above startup, the supervisor, running ticket sessions, and failures. Its activity body scrolls while the header and action footer remain visible. If the scope and eligible filters match no unfinished tickets, it explains that there is no matching work. Pause Auto Build, then choose **Stop Auto Build** to change its configuration.

The header button always says **Auto Build**. It shows a Play icon when Auto Build is stopped without an error. While Auto Build is on, or after an error, it shows a colored status indicator: the session spinner while work runs, a blue moon while the supervisor sleeps, a red mark if the supervisor fails, and a green check when the run is complete. A run is complete when every ticket in the supervisor's saved scope has a completed status. Reopening one of those tickets clears the check. Click the button to open a popover with a separate supervisor row and running ticket sessions. Each row uses the normal session status icon and color. The popover shows used capacity and its limit. Click a session to inspect it.

Click **Pause** in the footer to suspend new supervisor wake-ups and automatic dispatches. Current sessions continue. **Resume** retains the supervisor conversation, saved scope, and dispatch history. While paused, the danger-colored **Stop Auto Build** action cancels every linked supervisor, implementation, review, repair, and request conversation, including queued follow-ups. Unrelated manual sessions continue. A failed cancellation keeps the run paused so Stop can be retried. Changes already saved in a workspace remain available. Starting after Stop creates a fresh supervisor conversation. If the supervisor conversation is deleted, the run pauses and keeps its worker ownership history. Stop it before starting another run.

Auto Build keeps working when you close the timeline and resumes its checks after restarting Prompt Studio. Starting it again preserves your prompt, supervisor model, eligibility filters, and the merged-dependencies choice. A run saved before eligible filters existed stays stopped until you configure it.

## When work needs attention

If the supervisor cannot start or resume, Auto Build pauses and its activity popover shows the error. The saved failure does not appear as a timeline error or in a new start form. Resolve the problem and resume the run. Existing attempts remain available.

The activity popover shows a small banner when the supervisor fails or needs input, all running ticket sessions need input, or no work can run because of dependencies, blockers, or review requests. A finished board does not show a blocker banner.

If an implementation needs help, answer every open [review request](0006-review-requests.md). The supervisor can then resume that attempt in the same workspace and session when capacity is available, with your answers included.

An answer is not proof that dependency code was integrated. Planner checks actual Git ancestry even for completed prerequisites. If an existing attempt lacks their submitted code, the supervisor assigns `update-stack` to its current owner before implementation continues. The owner verifies the files, validates the repaired stack, and submits a revision. Repeated reports of the same missing files need stack repair, not another confirmation or an unchanged resume.

When a completed prerequisite has a replacement GitHub PR, Planner checks its most recently linked PR and verifies that its merge commit is included in the selected base. A stale attempt from a deleted workspace does not hide that delivery. An explicitly selected attempt must have a submitted revision that matches the PR head; a merged PR from another variant cannot replace it. An older merged stack-promotion PR cannot substitute for a newer replacement that is still open or absent from the selected base. If GitHub cannot verify the latest PR, the dependency stays blocked. Pending human requests still apply. Each work query shares GitHub delivery reads across its tickets. Later queries and the final dispatch check read fresh evidence.

A missing historical workspace appears as a runnable `recover-workspace` action with its Git error. Dispatch starts a continuation in a fresh managed workspace, seeded from the surviving branch, latest submitted commit, saved event HEAD, or required base. The continuation is linked to the old session when it still exists and receives the saved session, revision, report and PR references to inspect. It can fetch previous code or restart implementation when that code cannot be found. The old attempt and reviews stay as history; the new owner becomes the selected continuation. Unrelated discovery continues, and real dependency, pending-input, ambiguity, assignment and capacity rules still apply.

An unfinished implementation whose session completed, was cancelled, or failed can also resume in the same workspace and session. A run lost to a disconnect or host shutdown resumes once in the same conversation, even after a submitted revision. A session that a person stopped stays stopped. Planner uses the selected attempt, or the sole remaining attempt when no selection exists. Multiple attempts require an explicit selection. Recovery still waits for prerequisites, capacity, and all open implementation review requests. Each stopped turn resumes once.

Submitted work is also offered as a `repair` action when its PR has a merge conflict, its CI failed, or its PR head differs from the submitted revision. The owner repairs it in the same workspace and submits the new HEAD. Old review or CI results do not count for a new HEAD. Unavailable evidence stays a visible blocker. Waiting tickets include the current owner's state and next action. Submitted work is offered as `update-stack` when its workspace has an unrecorded HEAD, its required base differs from the latest revision, or it lacks the current selected dependency base. The supervisor follows up with the existing implementation owner. It does not create another attempt or change an old review verdict.

If nothing starts, check the eligibility filters, prerequisites, default agent, and in-progress limit. The activity popover lists tickets that cannot start, including tickets with existing work. Restarting Auto Build preserves that work; it does not create another implementation for the same ticket. Open those tickets to inspect their work, or add new tickets to test another run. The startup message appears only while a background check is queued or running. The supervisor can also leave valid tickets unassigned when they do not match your prompt.

## Agent commands

The supervisor uses public Planner commands:

```sh
pst pstdio-planner auto-build read
pst pstdio-planner auto-build scope --revision <mode-revision> --queries '[{"track":"Workbench"}]'
pst tickets next --track Workbench
pst tickets panel --id PS-123
pst pstdio-planner auto-build dispatch --ticket PS-123 --revision <mode-revision>
```

The scope command saves the work selection for the current mode revision and returns fresh matching work. Use `[{}]` for the whole project. Scope fields combine within each query; the queries combine as alternatives. Set eligibility filters here, rather than temporary priorities. Wait for the supervisor to start before manual dispatch. A `supervisor-not-ready` result starts no work. The `next` query reports the current mode revision, launchable `tickets`, `waiting` tickets with reasons and dependency IDs, and capacity. It is read-only and works while Auto Build is off. While Auto Build is on, its filters narrow the saved scope. Prerequisites in other tracks still apply. Unless **Require merged dependencies** is on, submitted dependency revisions remain valid stack bases. Actively running implementation owners still block new children. The query exposes repair in an existing workspace instead of leaving the track with no actionable work. The implementation owner reconciles conflicting dependency code through `update-stack`.

Dispatch rechecks the mode, eligibility filters, assignments, prerequisites, exact heads, and capacity before launching, resuming, or repairing work. Use the revision from the latest query. An earlier revision cannot dispatch work after Auto Build is stopped or restarted. The old `pst pstdio-planner auto-build candidates` command is deprecated in favor of `pst tickets next` and remains available through 0.44. Its CLI help names the replacement; it is removed in 0.45.

For work that must build on a feature branch, pass the same `--base <branch>` to `tickets next` and `auto-build dispatch`. This selects the root dependency base for that launch without changing project settings. To continue a linked manual draft, also pass `--workspace-id <id>` to dispatch. Planner preserves its branch and files, requires no managed attempt or active session in that workspace, and tells its new owner to commit the draft and integrate the required base before continuing. Submission still verifies actual Git ancestry. Existing managed attempts keep their owner, workspace, and recorded base; dispatch them without overrides and use `update-stack --base <branch>` in that owner session when the required target changes.


## Timeline presentation

The Timeline **Display settings** menu includes **Show passed milestones** and **Show completed milestones**, both on by default. Passed means the milestone date is before today. Completed means every ticket in a nonempty milestone has a configured completed status. Search and ticket filters do not change that decision. Undated work stays visible. Milestone visibility and collapsed tracks and milestones are remembered for the project across reloads and saved-view changes.

Use `pst pstdio-planner auto-build pause`, `resume`, and `stop` for the same lifecycle controls from the CLI. Stop requires a paused run.
