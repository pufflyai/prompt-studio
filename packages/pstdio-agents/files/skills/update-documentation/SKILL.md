---
name: update-documentation
description: "Use when asked to update, add, or modify project documentation, save lessons learned or write a new spec. Edit markdown files in `.pstdio/docs/` and update `navigation.json` for sidebar changes."
---

## User Input

```text
$ARGUMENTS
```

## Workflow

1. Read `.pstdio/docs/navigation.json` to understand the current sidebar structure and available pages.
2. Apply the requested documentation changes while preserving the existing structure and update the `navigation.json` file if needed.


## Documentation Location

All documentation lives in `.pstdio/docs/` at the repo root, committed to version control.

## Documentation Structure

```
.pstdio/docs/
├── navigation.json        ← sidebar structure
├── index.md               ← overview / landing page
├── specs/                 ← behavioral specifications
│   └── *.md
├── architecture/          ← system design decisions
│   └── *.md
├── known-issues/          ← unresolved known problems
│   └── *.md
├── lessons-learned/       ← resolved problems and insights
│   └── *.md
└── contributing/          ← contributor / setup guides
    └── *.md
```

### Recommended Categories

| Category | Purpose | One file per |
| --- | --- | --- |
| `spec/` | What the software does — signatures, arguments, output examples, error messages. No implementation details. | topic |
| `architecture/` | System design decisions, component relationships, diagrams, and reasoning behind choices. | topic |
| `known-issues/` | Unresolved problems — what the issue is, why it exists, the risk, and a potential fix. When resolved, move to `lessons-learned/`. | issue |
| `lessons-learned/` | Difficult problems or bugs that were eventually figured out — what went wrong, why, and how it was solved. | topic |
| `contributing/` | How to set up and run the project locally. Practical, copy-paste-friendly commands. | topic |

### Navigation (`navigation.json`)

Defines the sidebar tree. Each entry has `text`, an optional `link` (maps to a `.md` file), and optional nested `items`. Update whenever you add, remove, or rename a page.
