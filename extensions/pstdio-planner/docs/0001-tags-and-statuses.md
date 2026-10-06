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

Open **Settings → Project → Statuses** to add, rename, recolor, reorder, or delete statuses. The same panel sets the default status for new tickets and the commands each column offers: **Create** and **Archive all**. From a terminal, use [`pst statuses`](0004-cli.md#statuses).

When you delete a status, its tickets move to the default status.

### Status changes that Planner makes

Planner moves a ticket by itself while agents work on it. The ticket goes to In Progress while an agent implements it, to In Review while its work waits for or gets a review, and to Blocked when every attempt is blocked. Planner never moves a ticket to Done. You decide when the work is delivered. See [Attempts](0002-attempts.md#how-planner-sets-the-ticket-status) for the full rules.

Planner finds these statuses by name. If you rename In Progress, In Review, or Blocked, Planner can no longer move tickets into it. If you rename Done, Planner no longer treats the tickets in it as finished.

## Tags

A tag is a field on a ticket with a list of options. A single-select tag holds one option, such as one priority. A multi-select tag can hold several options. Each option can have a color and an icon.

A new project starts with these tags:

| Tag        | Type          | Options                           |
| ---------- | ------------- | --------------------------------- |
| Priority   | single-select | Low, Medium, High, Urgent         |
| Type       | single-select | Bug, Feature, Chore               |
| Complexity | single-select | Simple, Moderate, Complex         |
| Flags      | multi-select  | Review Needed                     |

Open **Settings → Project → Ticket tags** to add, rename, reorder, or delete tags and their options. From a terminal, use [`pst tags`](0004-cli.md#tags). When you delete a tag, Planner removes its options from every ticket.

The Review Needed flag tells people that a ticket waits for a human decision. Planner sets it, for example, when a reviewer approves an attempt. While it is set, Planner does not change the ticket's status. Planner always keeps the Flags tag and its Review Needed option. If you delete them, Planner adds them back. You can rename them.

## Colors

Statuses and tag options use the same color names: `gray`, `red`, `orange`, `amber`, `yellow`, `lime`, `green`, `teal`, `cyan`, `blue`, `indigo`, `violet`, `purple`, `pink`, and `rose`.

## Where the data lives

Planner keeps tickets, statuses, and tags in Prompt Studio's storage for the project, not in your repository. Other tools read and change them through Planner's commands. The [CLI](0004-cli.md) lists them.
