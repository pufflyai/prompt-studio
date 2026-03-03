---
name: update-documentation
description: "Use when asked to update, add, or modify project documentation. Pull the latest project documentation, apply updates, and save changes back."
---

## User Input

```text
$ARGUMENTS
```

## Workflow

1. Run `npx pstdio@latest docs pull` to pull the latest persisted documentation snapshot to `.pstdio/docs`:
   - If the pull fails because docs have not been initialized, run `npx pstdio@latest docs init` first, then retry.
2. Read `.pstdio/docs/navigation.json` to understand the current sidebar structure and available pages.
3. Apply the requested documentation changes:
   - **Adding a new page**: create the markdown file under `.pstdio/docs/`, then add a sidebar entry in `navigation.json` with `{ "text": "<title>", "link": "<relative-path>" }`.
   - **Updating an existing page**: edit the markdown file in place.
   - **Removing a page**: delete the markdown file and remove its sidebar entry from `navigation.json`.
   - **Reorganizing**: update `navigation.json` sidebar order or grouping. Groups use `{ "text": "<group>", "items": [...] }`.
4. Save the updated documentation:
   - Run `npx pstdio@latest docs save`.
   - Verify the command reports the expected number of updated/removed files.
5. Summarize the changes made: list added, updated, and removed pages.

## Output Locations

- Documentation files: `.pstdio/docs/`
- Sidebar config: `.pstdio/docs/navigation.json`
