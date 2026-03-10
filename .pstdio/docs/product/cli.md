---
status: "draft"
created: "2026-03-10T20:12:05Z"
---

# Product Requirements Document: CLI

## Summary

The CLI is the primary operational interface for Prompt Studio. This page indexes command-group PRDs and reflects the current command tree in `packages/pstdio/src/adapters/cli/commands`.

## Problem

CLI docs were moved out of `specs/cli`, but command pages were nested under `product/cli/files` and drifted from the live command surface.

## Goals

- Keep command docs under `/product/cli/*`.
- Cover every currently registered top-level CLI command.
- Keep command-group pages aligned with the code-backed command tree.

## Non-Goals

- Redesign CLI command behavior in this documentation change.
- Document non-registered draft commands as shipped functionality.

## Top-Level Commands

| Command | Purpose |
| ------- | ------- |
| `pstdio` | Start API + dashboard and open the dashboard browser route. |
| `pstdio serve` | Start API + dashboard server in one process. |
| `pstdio close` | Stop the background API process. |
| `pstdio agents [command]` | Manage coding agents. |
| `pstdio projects [command]` | Manage projects and project startup scripts. |
| `pstdio sessions [command]` | Manage agent sessions. |
| `pstdio statuses [command]` | Manage ticket statuses. |
| `pstdio tags [command]` | Manage tags. |
| `pstdio templates [command]` | Manage templates. |
| `pstdio tickets [command]` | Manage tickets. |
| `pstdio workspaces [command]` | Manage workspaces. |

## Command Group Pages

| Page | Coverage |
| ---- | -------- |
| [`/product/cli/agents`](/product/cli/agents) | `agents` command group. |
| [`/product/cli/feedback`](/product/cli/feedback) | Help and feedback behavior for missing/invalid commands. |
| [`/product/cli/projects`](/product/cli/projects) | `projects` command group. |
| [`/product/cli/sessions`](/product/cli/sessions) | `sessions` command group. |
| [`/product/cli/setup`](/product/cli/setup) | `pstdio`, `pstdio serve`, and `pstdio close` runtime behavior. |
| [`/product/cli/statuses`](/product/cli/statuses) | `statuses` command group. |
| [`/product/cli/tags`](/product/cli/tags) | `tags` command group. |
| [`/product/cli/templates`](/product/cli/templates) | `templates` command group. |
| [`/product/cli/tickets`](/product/cli/tickets) | `tickets` command group. |
| [`/product/cli/workspaces`](/product/cli/workspaces) | `workspaces` command group. |
| [`/product/cli/update`](/product/cli/update) | Draft update command design (not implemented). |
| [`/product/cli/workspaces-multi-repo-draft`](/product/cli/workspaces-multi-repo-draft) | Draft multi-repo workspace direction (not implemented). |

## Rules & Constraints

- Command docs in this section should track currently registered CLI commands.
- Draft pages remain explicitly marked as draft and non-implemented.
- Product docs describe behavior; architecture docs explain implementation details.

## Verification & Evidence

- **Commands to run**: `sed -n '1,220p' packages/pstdio/src/adapters/cli/commands/index.ts`, `find .pstdio/docs/product/cli -maxdepth 1 -type f | sort`, `sed -n '1,260p' .pstdio/docs/navigation.json`
- **Expected evidence**: Top-level commands in code are represented by pages under `/product/cli/*` and navigation links resolve to `/product/cli/<page>`.
- **Where to find artifacts**: `packages/pstdio/src/adapters/cli/commands/`, `.pstdio/docs/product/cli/`, `.pstdio/docs/navigation.json`
