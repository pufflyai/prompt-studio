# Project Timeline

Open **Tickets** or **Project Timeline** under **Project Planning** in the project sidebar. The timeline entry uses the timeline icon. Both views are part of Planner and use the same tickets, statuses, tags, and ticket form.

Both boards use the shared Kanban card. Right-click a card for the same ticket actions, including Run attempt, Refine ticket, Archive, and Delete. Edit property bubbles directly on either board; both views show the saved changes. Click a card to open its ticket, or its pending review requests when it needs human input. Timeline cards keep their full titles. Tickets waiting for unfinished prerequisites appear slightly dimmed. The timeline shows **Blocked** only when prerequisites are complete and the ticket has a blocked status or another recorded blocker.

Move around the timeline like a map. Scroll with two fingers on a trackpad, use the mouse wheel, or drag empty canvas to pan. Pinch on a trackpad or touch screen to zoom around your fingers. A touch pinch can move and zoom at the same time. Ctrl+wheel also zooms around the pointer. The zoom buttons remain available, and focusing the canvas lets the arrow keys pan. Ticket cards keep their normal click and drag actions.

The canvas renders nearby cards as you move, keeping the selected, focused, and dragged card available. Connection status and page-wide failure notices belong to the host chrome. The timeline keeps loaded content during a failed refresh and retries automatically. Forms keep validation messages beside the fields that need attention.

Right-click an empty track or milestone to create a ticket or an agent review gate. Write the ticket body in the shared markdown editor and choose its properties. Planner derives the title from the body. Attachments use Planner's existing file upload.

Use **New track** to add a value to the single-select Track tag. The timeline needs exactly one tag named Track, and it must be single-select. If Track is multi-select, or several tags are named Track, Tickets and every ticket command keep working, and a host notification explains what to change in **Settings → Project Planner → Ticket tags**. See [Tags](0001-tags-and-statuses.md#tags) for changing a multi-select tag to single-select. Create milestones on the date gutter, then drag tickets between tracks and milestones. Prerequisites form the dependency graph. Selecting a ticket shows a ticket’s dependencies, review gate, and review requests. Open the ticket to read its full document. Answer tasks and decisions in the review panel, or use **Open chat** to get help from the request's linked chat. These are Planner [review requests](0006-review-requests.md), the same ones the CLI and attempt workflows use. Each card shows its configured ticket status name, icon, and color. Completion, blocked flags, and active progress use the status IDs selected in Planner's workflow settings: open **Settings → Project → Extensions**, select **Project Planner**, and use its **Settings** tab. Renaming a column keeps this behavior; an empty selection turns off only that feature. A separate count opens **Needs attention**. It shows the open count in orange, or the resolved total in green when nothing is waiting. Review state does not replace the ticket status. Open or unreadable requests own the indicator; a manual tag alone never asks for input. An unreadable request shows its record error and recovery instructions, and keeps work paused. The panel never substitutes the whole ticket body for a missing request.

The header uses the same view tabs, search, filter menus, and filter rules as Kanban and data tables. **Tickets** and **Project Timeline** each have their own saved views, default view, and active selection. Creating, renaming, duplicating, deleting, or editing a timeline view affects only Project Timeline. You can keep different filters on each page. Timeline stores its selection and filter edits in project preferences so they survive navigation and reloads. Advanced filters support groups and negative conditions. Search stays local to the screen.

A Track rule in the filter also chooses the track columns. For example, Track is any of Product and Platform shows only those two columns, in the order of the Track options. Unassigned appears when the rule accepts tickets without a track, such as Track is empty. A track stays visible when another part of an "any of these rules" group could still match its tickets. Without a Track rule, every track is shown. Search and other filters only hide tickets. Filtering never changes a ticket's track.

Use ticket filters for Status, Milestone, Milestone date, Milestone progress, Needs attention, and Review requests. For example, exclude Done tickets, exclude Completed past milestone, or show Needs attention → Yes. These properties can be saved in each page's views. Change a ticket's milestone in its Properties panel or by dragging it in the timeline. The board create form creates unscheduled tickets; the timeline form also chooses placement and preserves the saved ticket when placement needs a retry. Use **Display** to show or hide card properties. Timeline cards show Status and the Needs attention bubble by default. The bubble shows the pending request count, or the resolved total when nothing is waiting, and opens the ticket’s Needs attention page. It uses the same indicator as the ticket overview. These choices save with the timeline view and survive navigation and reloads. Dependency arrows are smooth curves from the prerequisite to the ticket that waits on it. The graph keeps its dependency execution order. Milestone progress uses active tickets, matching the graph; archived tickets remain available in Tickets without active timeline properties. Hover and drop indicators use the shared navigation indicator color. The add-milestone preview appears above ticket cards.

## Milestone display and collapsing

**Display** includes **Show passed milestones** and **Show completed milestones**, both enabled by default. Passed milestones have a date before today. Completion uses all active tickets in the milestone before ticket filters or search. Empty milestones are not completed, and unscheduled work stays visible.

Visibility choices and collapsed tracks and milestones save per project. They survive reloads and saved-view changes without changing the query in a saved view.

## Milestone ETA

Each milestone shows its estimated time remaining to the left of its progress bar. The bar counts completed tickets. The ETA weights tickets by the configured Complexity options, ordered from simplest to most complex: 1, 2, 3, and so on. A ticket without a complexity uses the middle weight. Projects without complexity options use equal weights.

Planner measures completed complexity across active project tickets against elapsed time since the project's first recorded attempt started. It applies that observed pace to the remaining complexity in each milestone, including milestones that have not started. Parallel work and waiting are already included in the elapsed time. Hover or focus the ETA to see its basis.

Saved view filters and search update each milestone's ETA, progress, and review-requested count to include only matching tickets. Opening the review queue also includes only those tickets. Hiding completed tickets does not discard the completed work used to measure the project's pace. Collapsing a milestone or track does not change its totals.

`ETA —` means the project does not yet have a completed ticket and a recorded start to measure, or the milestone is empty. Completed milestones show `Done`. Unscheduled work has no milestone ETA. The estimate reflects past pace; it is not a promised deadline. The plan CLI returns the unfiltered derived ETA without storing another workflow state.

## Auto Build

Auto Build uses your prompt and eligibility filters to assign valid, unassigned tickets across the project. Its modal lets you choose the supervisor model. A supervisor sleeps between checks and resumes when more work can run. The selected view, search, and display filters only affect what you see.

Open **Auto Build** in the header to start it or inspect its supervisor, running ticket sessions, and capacity. Pause suspends new assignments while running sessions continue. Resume continues the same supervisor and scope. See [Auto Build](0007-auto-build.md) for review blocking, dependency stacking, and the full workflow.

## CLI

Run `pst pstdio-planner timeline --help` to see the commands. For example:

```sh
pst pstdio-planner timeline plan read
pst pstdio-planner auto-build configure --enabled true --prompt 'Choose valid tickets for the next release.'
pst pstdio-planner auto-build configure --enabled false
pst pstdio-planner timeline track create --name Product
pst pstdio-planner timeline deadline create --date 2026-10-15 --name Preview
pst pstdio-planner timeline ticket create --content '# Build the preview' --deadline 2026-10-15
pst pstdio-planner timeline plan move --ticket PS-32 --deadline none
```

## Recover an interrupted write

Timeline writes and attempt launches use guards owned by the running Planner runtime. A guard is released when its write succeeds or fails. A crash clears the guards when the process exits, so restarting and retrying cannot inherit a blocking lock. Existing persisted write claims no longer block work, and manual claim inspection or release is not needed.

A slow active writer keeps its guard until it finishes. If another write is still running, retry after it finishes. If the runtime has stopped responding, restart Prompt Studio and retry. A partially saved ticket keeps its identity so placement can be retried without creating another ticket. See [the runtime write-guard decision](../../../documentation/adrs/0083-temporary-runtime-planner-write-guards.md).
