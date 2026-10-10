# Ticket timeline

Open **Tickets** or **Ticket timeline** under **Project Planning** in the project sidebar. The timeline entry uses the timeline icon. Both views are part of Planner and use the same tickets, statuses, tags, and ticket form.

Both boards use the shared Kanban card. Timeline cards keep their full titles. Tickets waiting for unfinished prerequisites appear slightly dimmed. The timeline shows **Blocked** only when prerequisites are complete and the ticket has a blocked status or another recorded blocker.

Right-click an empty track or milestone to create a ticket or an agent review gate. Write the ticket body in the shared markdown editor and choose its properties. Planner derives the title from the body. Attachments use Planner's existing file upload.

Use **New track** to add a value to the single-select Track tag. Create milestones on the date gutter, then drag tickets between tracks and milestones. Prerequisites form the dependency graph. Selecting a ticket shows its instructions, dependencies, review gate, and review requests. Answer tasks and decisions in the panel, or use **Open chat** to get help from the request's linked chat. These are Planner [review requests](0006-review-requests.md), the same ones the CLI and attempt workflows use. Each card shows its configured ticket status name, icon, and color. A separate icon shows **Review requested** while input is needed, or **Review answered** after a request is answered. Review state does not replace the ticket status.

The header uses the same saved views, search, filter menus, and filter rules as Kanban and data tables. Ticket views are shared with **Tickets**: create, rename, duplicate, delete, and save filters from either board. Advanced filters support groups and negative conditions. Search stays local to the screen.

Use ticket filters for Status, Milestone, Milestone date, Milestone progress, and Needs attention. For example, exclude Done tickets, exclude Completed past milestone, or show Needs attention → Yes. These properties are available in both Tickets and Ticket timeline and can be saved in shared views. Change a ticket's milestone in its Properties panel or by dragging it in the timeline. The board create form creates unscheduled tickets; the timeline form also chooses placement and preserves the saved ticket when placement needs a retry. The timeline has no separate Display menu. Dependency arrows use square corners. The graph keeps its dependency execution order. Milestone progress uses active tickets, matching the graph; archived tickets remain available in Tickets without active timeline properties. Hover and drop indicators use the shared navigation indicator color. The add-milestone preview appears above ticket cards.

## CLI

Run `pst pstdio-planner timeline --help` to see the commands. For example:

```sh
pst pstdio-planner timeline plan read
pst pstdio-planner timeline track create --name Product
pst pstdio-planner timeline deadline create --date 2026-10-15 --name Preview
pst pstdio-planner timeline ticket create --content '# Build the preview' --deadline 2026-10-15
pst pstdio-planner timeline plan move --ticket PS-32 --deadline none
```

## Recover an interrupted write

Timeline writes use temporary owner claims because the extension storage API does not provide transactions. Stop the old writer before recovery. Run `pst pstdio-planner timeline write-claim read`, then release only the abandoned claim with `pst pstdio-planner timeline write-claim release --key <key> --expected-token <token>`. A different owner token refuses the release. Never release a running writer. See [the temporary write-claim decision](../../../documentation/adrs/0062-temporary-timeline-write-claims.md).
