---
status: "draft"
created: "2026-03-10T20:12:05Z"
---

# Product Requirements Document: Templates and Skills

## Summary

Prompt Studio exposes templates and skills from enabled extensions, and supports project-scoped template management through the API and CLI.

## Problem

The old template docs mixed real behavior with unsupported ideas such as global override precedence and document sync flows that are not part of the current product.

## Goals

- Describe the current template and skill behavior accurately.
- Make the PRD-first document template set explicit.
- Clarify what is currently project-scoped versus what remains bundled-only.

## Non-Goals

- Global template override precedence.
- Claiming that custom prompt templates are fully wired into current command flows.

## Overview

Current extension-provided templates are listed through the project template registry. Project creation does not copy repository-bundled templates into project-owned rows. Dashboard/API edits to extension templates write the installed extension source file.

Current extension-provided skills are listed through the project skill registry. Adding an extension to a project installs its skills into every configured agent selected for that project, and the dashboard shows which agents have the skill installed locally.

## Requirements

### Functional Requirements

1. Project creation must not seed repository-bundled templates into project-owned records.
2. `templates list`, `create`, `update`, and `delete` must manage project-scoped template records through the API.
3. `templates write` must support two modes:
   - `--target <path>` renders the template to an arbitrary file path (overwriting any existing file).
   - `--ticket <shorthand>` renders the template to `.pstdio/tickets/<shorthand>/ticket.md` and preserves its existing H1 title.
4. Extension project setup must install extension skills into each configured agent enabled for the project.
5. Document scaffolding should use `prd` as the default requirements format.

### UX Requirements

- Template commands should make the template type visible.

### Operational Requirements

- Project-owned template content is stored through project template records.
- Extension template content is stored in installed extension source files; dashboard/API edits write those files directly.
- Extension skill content is stored in installed extension source files and installed to enabled project agents during extension setup.

## Behavior

1. `projects create` creates the project and does not copy bundled templates or skills into project-owned records.
2. `templates create` and `templates update` manage project template content by type (`prompt`, `ticket`, `document`).
3. `templates write --name <name> --target <path>` renders a template to an arbitrary file path relative to the current directory (overwriting any existing file).
4. `templates write --name <ticket-template> --ticket <ticket-shorthand>` rewrites that ticket's `ticket.md` and preserves its existing H1 title.

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
- The dashboard can edit project-owned templates and extension-provided templates.
- Bundled prompt templates still exist for internal prompt rendering, but project-scoped prompt customization is not yet a documented end-user workflow.

## Errors

| Error                                                               | Cause                                                                    |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `Template not found: <name>`                                        | The requested project template does not exist.                           |
| `Ticket not found: <shorthand>`                                     | `--ticket` shorthand has no local ticket directory.                      |
| `Exactly one of --target or --ticket is required.`                  | `templates write` invoked without `--target` or `--ticket`.              |
| `--target and --ticket are mutually exclusive.`                     | Both `--target` and `--ticket` supplied to `templates write`.            |
| `Not inside a pstdio project. Run 'pstdio projects create' first.`  | A project-scoped template command was run without linked project config. |
