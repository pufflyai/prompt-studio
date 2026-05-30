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
- Document templates: `prd` (default), `adr`, `architecture-overview`, `cookbook`, `code-review`, `lessons-learned`, `changelog-entry`, `contracts`, `schemas`, `research`

Current bundled skills are installed through agent setup and skill-install flows into agent skill directories in the repo or global agent config. Skill content is stored in the project database and can be edited by users. The installed copies in agent directories are derived from the DB-stored version.

## Requirements

### Functional Requirements

1. Project creation must seed the bundled ticket and document templates.
2. `templates list`, `create`, `update`, and `delete` must manage project-scoped template records through the API.
3. `templates write` must support two modes:
   - `--target <path>` renders the template to an arbitrary file path (overwriting any existing file).
   - `--ticket <shorthand>` renders the template to `.pstdio/tickets/<shorthand>/ticket.md` and preserves its existing H1 title.
4. Agent setup and install flows must install bundled skills into the configured agent's skills directory.
5. Updating a skill to the latest bundled version must propagate the updated content to all agent directories in all linked repos.
6. On server startup, missing skills must be auto-installed for all configured agents in all linked repos. Existing skills must not be overwritten.
7. The skill detail view must show which agents have the skill installed locally (per-agent badges) or indicate when the skill is not installed.
8. Document scaffolding should use `prd` as the default requirements format.

### UX Requirements

- Template commands should make the template type visible.

### Operational Requirements

- Template content is stored through project template records.
- Skill installation must respect the target agent and whether installation is project-local or global.
- Skill content in DB file storage is the source of truth for user-edited skills. The startup auto-install and repo registration flows read from DB, not from bundled defaults.

## Behavior

1. `projects create` seeds bundled ticket and document templates for the project.
2. `templates create` and `templates update` manage project template content by type (`prompt`, `ticket`, `document`).
3. `templates write --name <name> --target <path>` renders a template to an arbitrary file path relative to the current directory (overwriting any existing file).
4. `templates write --name <ticket-template> --ticket <ticket-shorthand>` rewrites that ticket's `ticket.md` and preserves its existing H1 title.
5. `agents setup` and `agents install-skills` install bundled skills into the chosen agent directory.
6. Updating a skill via the dashboard writes the bundled content to DB file storage and to all agent directories (`.claude/skills/`, `.agents/skills/`) in linked repos.
7. On API startup, `ensureSkillsInstalled` checks every project/repo/agent combination and installs any missing skill from DB storage. Skills already present on disk are left untouched to preserve user edits.

## Interface

### Bundled Document Templates

| Name              | Default | Purpose                                               |
| ----------------- | ------- | ----------------------------------------------------- |
| `prd`                   | yes     | Product behavior, goals, interface, and verification.  |
| `adr`                   | no      | Architectural decisions and tradeoffs.                 |
| `architecture-overview` | no      | Technical design, components, contracts, and rollout.  |
| `cookbook`              | no      | Practical how-to guidance.                             |
| `code-review`           | no      | Code review output artifact produced by `review-code`. |
| `lessons-learned`       | no      | Resolved incident or bug postmortems.                  |
| `changelog-entry`       | no      | Release changelog entry.                               |
| `contracts`             | no      | API / SDK / IPC contract shapes for a ticket.          |
| `schemas`               | no      | DB and data schema notes for a ticket.                 |
| `research`              | no      | Investigation notes and findings for a ticket.         |

### Template CLI Surface

| Command                   | Purpose                                       |
| ------------------------- | --------------------------------------------- |
| `pstdio templates list`   | List project templates.                       |
| `pstdio templates create` | Create a project template from file or stdin. |
| `pstdio templates update` | Update template content or default status.    |
| `pstdio templates delete` | Delete a project template.                    |
| `pstdio templates write`  | Render a template into a file path (`--target`) or a ticket (`--ticket`). |

## Rules & Constraints

- `templates write` requires exactly one of `--target <path>` or `--ticket <shorthand>`.
- The dashboard can read template assets but does not yet support editing them.
- Bundled prompt templates still exist for internal prompt rendering, but project-scoped prompt customization is not yet a documented end-user workflow.

## Errors

| Error                                                               | Cause                                                                    |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `Template not found: <name>`                                        | The requested project template does not exist.                           |
| `Ticket not found: <shorthand>`                                     | `--ticket` shorthand has no local ticket directory.                      |
| `Exactly one of --target or --ticket is required.`                  | `templates write` invoked without `--target` or `--ticket`.              |
| `--target and --ticket are mutually exclusive.`                     | Both `--target` and `--ticket` supplied to `templates write`.            |
| `Not inside a pstdio project. Run 'pstdio projects create' first.`  | A project-scoped template command was run without linked project config. |
