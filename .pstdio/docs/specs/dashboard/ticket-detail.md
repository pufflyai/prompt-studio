---
status: draft
---

# Ticket Detail

View and edit a single ticket in the dashboard. The ticket detail page is the primary surface for authoring ticket content, managing properties, and running agent sessions.

---

## Route

`/projects/:projectId/tickets/:ticketShorthand`

---

## Layout

```
+----------------------------------------------------------+
| [<] Parent / Shorthand            [Attempt] [...]        |
+----------------------------------------------------------+
|                                    |                      |
|  Markdown Editor                   | Properties           |
|                                    |   ID                 |
|  (editable, auto-saves)           |   Updated            |
|                                    |   Status             |
|                                    |   Complexity         |
|                                    |   Depends On         |
|                                    |   Parent             |
|                                    |   Tags               |
|                                    |                      |
|                                    | [Break into subs]    |
|                                    | Sub-tickets          |
|                                    | Files                |
+----------------------------------------------------------+
```

The page has three sections:

1. **Header** — back button, breadcrumb, attempt button, action menu.
2. **Content** — full-width markdown editor with debounced auto-save.
3. **Sidebar** — collapsible right panel with properties, sub-tickets, and files.

---

## Header

### Breadcrumb

Shows the ticket shorthand. When the ticket has a parent, the parent shorthand appears first as a clickable link.

### Attempt Button

- When no attempts exist, shows **"Run Attempt"** and opens a workspace creation dialog on click.
- When attempts exist, shows the attempt count and a diff summary (additions/deletions) from the latest attempt. Clicking navigates to the latest workspace page.

### Action Menu

A dropdown menu with actions:

| Action              | Behavior                                                        |
| ------------------- | --------------------------------------------------------------- |
| Create sub-ticket   | Opens the create ticket modal with the current ticket as parent |
| Break into subs     | Opens a dialog to start an agent session for ticket breakdown   |
| Refine ticket       | Opens a dialog to start an agent session for ticket refinement  |
| Archive ticket      | Toggles the ticket's archived flag                              |
| Delete ticket       | Shows a confirmation dialog, then deletes and navigates back    |

---

## Content Editor

A rich markdown editor that auto-saves content changes after a 400ms debounce. On unmount, any pending changes are flushed immediately.

When navigating between tickets, the editor resets its state to match the new ticket's content.

---

## Sidebar

The sidebar displays ticket metadata and related items. It can be collapsed to a thin strip with a toggle button.

### Properties

| Property    | Display                                                     |
| ----------- | ----------------------------------------------------------- |
| ID          | Ticket shorthand                                            |
| Updated     | Formatted timestamp                                         |
| Status      | Current status name                                         |
| Archived    | Shown only when archived                                    |
| Complexity  | Dropdown selector (low, medium, high, unspecified)          |
| Blocked     | Shown only when status is "blocked", displays block reason  |
| Depends On  | Clickable ticket links parsed from comma-separated value    |
| Parent      | Clickable ticket link or "None"                             |
| Tags        | Multi-select dropdown for project tags                      |

### Sub-tickets

Lists sub-tickets as clickable links. Shows "None" when empty.

### Files

Lists ticket files (excluding `ticket.md`). Hidden when no files exist.

---

## Modals

### Create Workspace

Configures a new workspace attempt. Fields:

- **Agent** — agent selector
- **Repository** — repo/branch selector (placeholder)

### Break Into Sub-tickets

Starts an agent session to decompose the ticket. Fields:

- **Template** — optional template selector (shown when templates exist)
- **Agent** — agent selector

### Refine Ticket

Starts an agent session to refine the ticket. Fields:

- **Additional context** — free-text textarea for guidance
- **Template** — optional template selector (shown when templates exist)
- **Agent** — agent selector

---

## Prompt Formats

### Refine

```
refine ticket: {shorthand} [with template {templateName}]

[Additional context:
{context}]
```

### Break Into Sub-tickets

```
breakdown ticket {shorthand} into sub-tickets [using template {templateName}]
```

---

## Data

The detail page fetches:

- **Project** — status options, tags, repositories, template assets
- **Tickets** — all project tickets (to resolve parent, sub-tickets, dependencies)
- **Attempt diff** — diff stats for the latest attempt (additions/deletions)
- **Ticket files** — files attached to the ticket

---

## Mutations

| Action             | Behavior                                              |
| ------------------ | ----------------------------------------------------- |
| Edit content       | Auto-saves via debounced PATCH                        |
| Change complexity  | PATCH ticket complexity                               |
| Change tags        | PATCH ticket tag assignments                          |
| Archive/unarchive  | PATCH ticket archived flag                            |
| Delete             | DELETE ticket, navigate back to ticket list            |
| Run attempt        | POST ticket attempt, opens workspace panel            |
| Start session      | POST session (for refine/break), opens workspace panel |
| Create sub-ticket  | POST ticket with parentId set                         |
