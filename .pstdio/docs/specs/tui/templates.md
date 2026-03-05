# TUI Spec: Templates Tab

Browse, preview, and manage templates. This is the third (rightmost) tab.

## Layout

Two panels, one visible at a time:

1. **List panel** — all templates in a scrollable list (default)
2. **Content panel** — raw template preview (opened with `Enter`, closed with `Esc`)

```
┌─ List panel ───────────────────────────────────────────┐
│  pstdio │ my-project                                   │
│  Tickets │ Docs │ ▸ Templates                          │
│────────────────────────────────────────────────────────│
│  ticket        ticket    *                             │
│  proposal      ticket                                  │
│  spec          docs      *                             │
│  adr           docs                                    │
│  cookbook       docs                                    │
│  review-me     docs                                    │
│                                                        │
│────────────────────────────────────────────────────────│
│ d:default  Enter:view  ?:help                          │
└────────────────────────────────────────────────────────┘

┌─ Content panel (Enter on "ticket") ────────────────────┐
│  pstdio │ my-project                                   │
│  Tickets │ Docs │ ▸ Templates                          │
│────────────────────────────────────────────────────────│
│  ticket │ type: ticket │ default                       │
│────────────────────────────────────────────────────────│
│  ---                                                   │
│  ticket_id: "{{TICKET_ID}}"                            │
│  user_prompt: "{{USER_PROMPT}}"                        │
│  created: "{{CREATED_AT}}"                             │
│  ---                                                   │
│                                                        │
│  # {{TICKET_TITLE}}                                    │
│                                                        │
│  ## References                                         │
│────────────────────────────────────────────────────────│
│ Esc:back  d:default  ?:help                            │
└────────────────────────────────────────────────────────┘
```

---

## List Panel

### Columns

| Column  | Width    | Content                     |
| ------- | -------- | --------------------------- |
| Name    | 14 chars | Template name               |
| Type    | 8 chars  | `ticket` or `docs`          |
| Default | 1 char   | `*` if default for its type |

Sorted by type (ticket first, then docs), then alphabetically by name.

### Navigation

| Key         | Action                          |
| ----------- | ------------------------------- |
| `g`         | Jump to first template          |
| `G`         | Jump to last template           |
| `Enter`     | Open content panel for selection|
| `Tab`       | Next tab (Tickets, wraps)       |
| `Shift+Tab` | Previous tab (Docs)             |
| `q`         | Quit TUI                        |

### Actions (List)

| Key | Action                                |
| --- | ------------------------------------- |
| `d` | Set selected as default for its type  |

---

## Content Panel

Full-screen view of a single template's raw content. Placeholders shown as-is (`{{TICKET_ID}}`), not rendered.

### Layout

1. **Header line** — name, type, default marker
2. **Separator**
3. **Body** — raw template markdown, scrollable

### Navigation

| Key       | Action             |
| --------- | ------------------ |
| `g`       | Scroll to top      |
| `G`       | Scroll to bottom   |
| `Esc`     | Back to list panel |

### Actions (Content)

| Key | Action                                |
| --- | ------------------------------------- |
| `d` | Set as default for its type           |

---

## Actions Detail

### Set Default (`d`)

Calls `PATCH /templates/{name}` with `default=true`. The `*` marker moves to the selected template. The previous default for that type loses its marker. Available from both list and content panels.

---

## Data

Fetched via `GET /templates` for the current project. Sorted by type (ticket first, then docs), then alphabetically by name.

---

## Hook

| Hook            | Responsibility                                    |
| --------------- | ------------------------------------------------- |
| `use-templates` | Fetch and cache templates for the current project |

Accepts project ID, returns `{ items, loading, error }`. Re-fetches on project change. SSE events trigger optimistic list updates.

---

## Panels & Components

| File                           | Description                     |
| ------------------------------ | ------------------------------- |
| `panels/template-list.tsx`     | Template list panel             |
| `panels/template-content.tsx`  | Single template content panel   |
| `components/template-item.tsx` | Single row in the template list |
