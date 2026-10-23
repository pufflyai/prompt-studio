# Tags and statuses

Statuses are the steps a ticket moves through and the columns of the ticket board. Tags are fields, such as Type or Priority, that you set on each ticket.

Each project has its own statuses and tags. Planner adds a default set the first time a project uses them.

## Statuses

Every ticket has exactly one status. A new project starts with these statuses, in this order:

| Status      | Color  | Meaning                                         |
| ----------- | ------ | ----------------------------------------------- |
| Backlog     | gray   | The default status for new tickets.             |
| Todo        | purple | Ready to be worked on.                          |
| In Progress | blue   | An agent or a person is working on the ticket.  |
| Blocked     | red    | The work is waiting on something else.          |
| In Review   | yellow | The work is ready for review or being reviewed. |
| Done        | green  | The work is finished.                           |

By default, only the Backlog column lets you create a ticket in it. The Done column has an **Archive all** action that archives every ticket in the column.

### Change statuses

Open **Settings → Project Planner → Ticket status** to add, rename, recolor, reorder, or delete statuses. The same panel sets the default status for new tickets and the commands each column offers: **Create** and **Archive all**. From a terminal, use [`pst statuses`](0004-cli.md#statuses).

When you delete a status, its tickets move to the default status.

### Who changes a ticket's status

The implementation agent keeps its ticket's status current while it works, and you can change it at any time. Planner does not move tickets when attempts start, sessions stop, or reviews finish. See [Attempts](0002-attempts.md#who-sets-the-ticket-status).

Planner does not find statuses by name. Choose which statuses count as completed, blocked, and active, and the status after merge, in Planner's workflow settings: open **Settings → Project → Extensions**, select **Project Planner**, and use its **Settings** tab. Selections use status IDs, so you can rename or reorder columns freely.

## Tags

A tag is a field on a ticket with a list of options. A single-select tag holds one option, such as one priority. A multi-select tag can hold several options. Each option can have a color and an icon.

A new project starts with these tags:

| Tag        | Type          | Options                           |
| ---------- | ------------- | --------------------------------- |
| Priority   | single-select | Low, Medium, High, Urgent         |
| Type       | single-select | Bug, Feature, Chore               |
| Complexity | single-select | Simple, Moderate, Complex         |

Open **Settings → Project Planner → Ticket tags** to add, rename, reorder, or delete tags and their options. From a terminal, use [`pst tags`](0004-cli.md#tags). When you delete a tag, Planner removes its options from every ticket.

A single-select tag holds at most one option on every ticket. Planner rejects a ticket change that would give it a second option. To change a multi-select tag to single-select, every ticket must hold at most one of its options first, including archived tickets and drafts. If some tickets hold several, the change fails, changes nothing, and lists those tickets. Choose one option on each of them, for example in the ticket's Properties panel or with `pst pstdio-planner set-ticket-attribute`, then change the type again. Planner never picks an option for you.

Pending requests appear in the numbered Needs attention bubble. Tags describe ticket properties and do not control pending input. See [Review requests](0006-review-requests.md).

## Colors

Statuses and tag options use the same color names: `gray`, `red`, `orange`, `amber`, `yellow`, `lime`, `green`, `teal`, `cyan`, `blue`, `indigo`, `violet`, `purple`, `pink`, and `rose`.

## Where the data lives

Planner keeps tickets, statuses, and tags in Prompt Studio's storage for the project, not in your repository. Other tools read and change them through Planner's commands. The [CLI](0004-cli.md) lists them.
