---
name: update-documentation
description: "Edit documentation and documentation structure. Use when asked to update, add, or modify documentation, save lessons learned, write a PRD, ADR, guide, or cookbook. Use when project requirements might get out of sync."
---

## Workflow

1. Read `.pstdio/docs/navigation.json` to understand the current sidebar structure and available pages.
2. When adding a new documentation page, prefer scaffolding from an existing template before writing markdown manually:
   - Run `pstdio templates list` to inspect all available project templates.
   - Bundled documentation templates are `prd`, `adr`, `cookbook`, `review-me`, and `lessons-learned`.
   - To scaffold one, run `pstdio templates write --name <prd|adr|cookbook|lessons-learned> --target docs/<path>`.
   - `pstdio templates write` creates the markdown file.
3. Apply the requested documentation changes while preserving the documentation structure and update the `navigation.json` file.

## Documentation Reference

### `prd/` — Product Requirements

- Describe what the software does, not how it is implemented.
- Include signatures, arguments, output examples, and error messages.
- Do not include internal implementation details, configuration values, or code references.

### `architecture/` — Architecture Documentation

- Describe system design decisions and how components relate to each other.
- Keep it high-level and implementation-agnostic.
- Include ASCII diagrams, rules, and the reasoning behind architectural choices.

### `known-issues/` — Known Issues

- Document known problems that are not yet resolved.

### `lessons-learned/` — Lessons Learned

- Document difficult problems or bugs that were eventually figured out.
- Capture guidance that helps future contributors avoid repeating the same mistakes.

### `contributing/` — Contributor Guides

- Describe how to set up and run the project locally.
- Update when prerequisites, development commands, or project structure change.
- Keep it practical with copy-pasteable commands.
