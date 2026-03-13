---
status: "draft"
created: "2026-03-10T20:12:05Z"
---

# Product Requirements Document: Templates and Skills

## Summary

Prompt Studio ships bundled ticket and document templates, supports project-scoped template management through the API and CLI, and installs bundled skills into configured agent directories.

## Problem

The old template docs mixed real behavior with unsupported ideas such as global override precedence and document sync flows that are not part of the current product.

## Goals

- Describe the current template and skill behavior accurately.
- Make the PRD-first document template set explicit.
- Clarify what is currently project-scoped versus what remains bundled-only.

## Non-Goals

- Global template override precedence.
- A dashboard UI for editing template assets.
- Claiming that custom prompt templates are fully wired into current command flows.

## Overview

Current bundled templates seeded at project creation:

- Ticket templates: `ticket` (default), `proposal`
- Document templates: `prd` (default), `adr`, `cookbook`, `review-me`, `lessons-learned`

Current bundled skills are installed through agent setup and skill-install flows into agent skill directories in the repo or global agent config.

## Requirements

### Functional Requirements

1. Project creation must seed the bundled ticket and document templates.
2. `templates list`, `create`, `update`, and `delete` must manage project-scoped template records through the API.
3. `templates write` must support two targets:
   - `docs/<path>` for document templates
   - `<ticket-shorthand>` for ticket templates
4. Agent setup and install flows must install bundled skills into the configured agent's skills directory.
5. Document scaffolding should use `prd` as the default requirements format.

### UX Requirements

- Template commands should make the template type visible.
- Docs scaffolding should update `navigation.json` automatically when writing a doc target.

### Operational Requirements

- Template content is stored through project template records.
- Skill installation must respect the target agent and whether installation is project-local or global.

## Behavior

1. `projects create` seeds bundled ticket and document templates for the project.
2. `templates create` and `templates update` manage project template content by type (`prompt`, `ticket`, `document`).
3. `templates write --name prd --target docs/<path>` writes `.pstdio/docs/<path>.md` and adds the page to navigation.
4. `templates write --name <ticket-template> --target <ticket-shorthand>` rewrites that ticket's `ticket.md`.
5. `agents setup` and `agents install-skills` install bundled skills into the chosen agent directory.

## Interface

### Bundled Document Templates

| Name              | Default | Purpose                                               |
| ----------------- | ------- | ----------------------------------------------------- |
| `prd`             | yes     | Product behavior, goals, interface, and verification. |
| `adr`             | no      | Architectural decisions and tradeoffs.                |
| `cookbook`        | no      | Practical how-to guidance.                            |
| `review-me`       | no      | Review context and checklist.                         |
| `lessons-learned` | no      | Resolved incident or bug postmortems.                 |

### Template CLI Surface

| Command                   | Purpose                                       |
| ------------------------- | --------------------------------------------- |
| `pstdio templates list`   | List project templates.                       |
| `pstdio templates create` | Create a project template from file or stdin. |
| `pstdio templates update` | Update template content or default status.    |
| `pstdio templates delete` | Delete a project template.                    |
| `pstdio templates write`  | Materialize a template into docs or a ticket. |

## Rules & Constraints

- `templates write` rejects ticket templates for `docs/...` targets.
- The dashboard can read template assets but does not yet support editing them.
- Bundled prompt templates still exist for internal prompt rendering, but project-scoped prompt customization is not yet a documented end-user workflow.

## Errors

| Error                                                               | Cause                                                                    |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `Ticket templates cannot target docs. Use a docs template instead.` | A ticket template was written to a docs target.                          |
| `Template not found: <name>`                                        | The requested project template does not exist.                           |
| `Not inside a pstdio project. Run 'pstdio projects create' first.`  | A project-scoped template command was run without linked project config. |
