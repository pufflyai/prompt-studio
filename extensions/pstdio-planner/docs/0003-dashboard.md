# Dashboard

Planner adds a ticket board and a page for each ticket to the Prompt Studio dashboard. This page explains what you see there and what each control does.

## Ticket board

Open **Tickets** in the project sidebar. The board shows one column for each [status](0001-tags-and-statuses.md#statuses), in status order. Newest tickets come first.

To reach off-screen columns, hold the primary mouse button and drag empty board space or a column heading. You can also use the horizontal scrollbar or your trackpad. Dragging a card moves the ticket instead.

### Cards

Each card shows the ticket's title and these properties:

- The ID, such as `PS-12`. A sub-ticket also shows the IDs of its parent tickets.
- The workspaces linked to the ticket, newest first. Each workspace badge shows the status of its running session, or of its last session when none is running. Select a badge to open the workspace.
- The Type and Priority tags.

### Create a ticket

Select the create button at the top of a column. By default only the Backlog column has one. In the **New ticket** form, write a description in Markdown, attach files if needed, and set the properties, such as tags. The first line of the description becomes the ticket's title.

You can also create tickets from a terminal with [`pst tickets create`](0004-cli.md#tickets), or let an agent do it with Planner's `create-ticket` skill.

### Move and change tickets

- Drag a card to another column to change its status.
- Choose **Manual** ordering in the display menu, then drag cards within a column to change their order.
- In the Done column, choose **Archive all** to archive every ticket in it.
- Select a card to open the ticket page.

### Display and filters

The display menu switches between **Board** and **List**. It also sets the grouping, the sub-grouping, the ordering, and the properties shown on each card.

The board shows active tickets only. Use the filter menu to show archived tickets, or to filter by status, parent, or tag.

To find a ticket quickly, search for it in the command palette. Tickets have their own group there.

## Ticket page

The ticket page has three parts: the ticket's sidebar, the editor, and the Properties panel.

### Sidebar

The sidebar lists, from top to bottom:

- The ticket itself. Select it to edit the ticket's description.
- The **Files** section lists extra Markdown files that belong to the ticket, and its image attachments. Choose **New file** to add a file. Right-click a file to rename or delete it. Images open in a read-only preview.
- The **Sub-tickets** section appears when the ticket has sub-tickets.
- The **Workspaces** section lists the project workspace and every workspace linked to the ticket. Choose **Create workspace** to add one. See [Attempts](0002-attempts.md#workspaces-on-a-ticket).
- The **Sessions** section lists the agent sessions linked to the ticket, including attempt, review, refine, and sub-ticket sessions.

### Editor

The editor shows the document you selected in the sidebar: the description, a ticket file, or an image. Edit the description and ticket files there.

### Properties

The Properties panel opens beside the editor. It shows the ticket's ID, its created and updated times, review links, status, dependencies, parent, and tags. It also shows the blocked reason when the ticket is blocked. Change the status and the tags here. You can also copy the ID from the panel.

### Ticket actions

The ticket's actions menu, in the page header, has these actions:

| Action                 | What it does                                                                                                     |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Run attempt            | Starts a managed attempt in a new Git worktree. See [Attempts](0002-attempts.md#run-an-attempt).                 |
| Refine ticket          | Starts an agent session that improves the ticket's description. You can pick a ticket template and add context. |
| Break into sub-tickets | Starts an agent session that splits the ticket into smaller tickets.                                            |
| Archive                | Archives the ticket. Shown on active tickets.                                                                    |
| Unarchive              | Makes an archived ticket active again. Shown on archived tickets.                                                |
| Delete                 | Deletes the ticket.                                                                                              |

Run attempt, Refine ticket, and Break into sub-tickets let you choose the agent. Refine ticket and Break into sub-tickets open their new session when it starts.

Archiving a ticket also archives a linked workspace once every ticket linked to that workspace is archived. The project workspace, and workspaces whose provider does not support archiving, stay available. Unarchiving keeps the ticket's status, tags, order, and content. Workspaces that were archived with the ticket stay archived.

## Notifications

Planner sends a notification when a ticket needs you:

- **Needs input**, when an agent session linked to the ticket waits for your answer. Choose **Reply to agent** to open the session.
- **Review proposal**, when an agent marks a proposal ticket as refined. Choose **Review proposal** to open the ticket. Choose **Approve** when the proposal is ready, which clears the notification.

## Settings

Planner adds these settings for each project:

- **Settings → Project → Extensions → Prompt Studio Planner → Settings** holds the options for the implement-ticket workflow. See the [Planner overview](../README.md#implementation-options).
- **Settings → Project → Ticket tags** edits the project's [tags](0001-tags-and-statuses.md#tags).
- **Settings → Project → Statuses** edits the project's [statuses](0001-tags-and-statuses.md#statuses).
- **Settings → Project → Templates** edits Planner's ticket, prompt, and document templates. The prompt templates hold the instructions Planner gives agents, for example when it runs an attempt or a review. Edit them to change how agents work on your tickets.
