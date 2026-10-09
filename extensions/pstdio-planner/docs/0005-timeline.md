# Ticket timeline

Open **Tickets** or **Ticket timeline** under **Project Planning** in the project sidebar. The timeline entry uses the timeline icon. Both views are part of Planner and use the same tickets, statuses, tags, and ticket form.

Both boards use the shared Kanban card. Timeline cards keep their full titles. Tickets waiting for unfinished prerequisites appear slightly dimmed. The timeline shows **Blocked** only when prerequisites are complete and the ticket has a blocked status or another recorded blocker.

Right-click an empty track or milestone to create a ticket or an agent review gate. Write the ticket body in the shared markdown editor and choose its properties. Planner derives the title from the body. Attachments use Planner's existing file upload.

Use **New track** to add a value to the single-select Track tag. Create milestones on the date gutter, then drag tickets between tracks and milestones. Prerequisites form the dependency graph. Selecting a ticket shows its instructions, dependencies, review gate, and pending human actions.

The header uses the same saved views, search, filter menus, and filter rules as Kanban and data tables. Ticket views are shared with **Tickets**: create, rename, duplicate, delete, and save filters from either board. Advanced filters support groups and negative conditions. Search stays local to the screen.

The display menu controls completed tickets, past deadlines, work needing attention, and arrow shape. These timeline preferences belong to the project; saving a ticket filter preserves Kanban's display settings and sorts. The graph keeps its dependency execution order. The timeline includes active tickets; archived tickets remain available in Tickets. Menu choices include icons. Resource previews are deferred to ticket resource links.

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
