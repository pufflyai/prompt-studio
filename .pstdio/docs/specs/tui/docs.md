# TUI Spec: Docs Tab

Browse and read project documentation. This is the middle tab — the existing docs functionality moves into the tab layout unchanged.

## Layout

Two panels, one visible at a time:

1. **List panel** — hierarchical document tree with expand/collapse (default)
2. **Content panel** — full-screen markdown viewer (opened with `Enter`, closed with `Esc`)

```
┌─ List panel ───────────────────────────────────────────┐
│  pstdio │ my-project                                   │
│  Tickets │ ▸ Docs │ Templates                          │
│────────────────────────────────────────────────────────│
│  ▾ Getting Started                                     │
│      Overview                                          │
│      Installation                                      │
│  ▸ API                                                 │
│  ▸ Architecture                                        │
│                                                        │
│────────────────────────────────────────────────────────│
│ Enter:open  /:search  ?:help                           │
└────────────────────────────────────────────────────────┘

┌─ Content panel (Enter on "Overview") ──────────────────┐
│  pstdio │ my-project                                   │
│  Tickets │ ▸ Docs │ Templates                          │
│────────────────────────────────────────────────────────│
│  Overview                                              │
│────────────────────────────────────────────────────────│
│  Welcome to pstdio. This guide walks you through…      │
│                                                        │
│────────────────────────────────────────────────────────│
│ Esc:back  ?:help                                       │
└────────────────────────────────────────────────────────┘
```

---

## List Panel

Hierarchical tree built from `navigation.json`. Sections expand/collapse with `Enter`. Leaf items open the content panel.

### Navigation

| Key         | Action                         |
| ----------- | ------------------------------ |
| `g`         | Jump to first item             |
| `G`         | Jump to last item              |
| `Enter`     | Expand section / open document |
| `/`         | Search docs (opens input bar)  |
| `Tab`       | Next tab (Templates)           |
| `Shift+Tab` | Previous tab (Tickets)         |
| `q`         | Quit TUI                       |

Search query shown below the tab bar: `12 docs │ filter: api`

---

## Content Panel

Full-screen markdown rendering of a single document. Opened with `Enter` from the list, closed with `Esc`.

### Navigation

| Key   | Action             |
| ----- | ------------------ |
| `g`   | Scroll to top      |
| `G`   | Scroll to bottom   |
| `Esc` | Back to list panel |

---

## Data

Loaded from the project's `navigation.json` and local doc files. Updates via SSE when docs change.

---

## Reused Code

No new hooks, panels, or components. The existing `DocsList`, `MarkdownView`, `useDocs`, and `useSelection` are reused as-is within the tab layout.
