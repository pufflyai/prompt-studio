# Product Documentation

## Summary

This section replaces the legacy `Specs` tree. It documents shipped Prompt Studio behavior in a PRD-style format instead of keeping proposal-era specs mixed with current functionality.

## Problem

The old docs mixed implementation plans, abandoned drafts, and current behavior. That made it hard to tell which commands and UI flows were actually supported in March 2026.

## Goals

- Document current product behavior only.
- Group behavior docs by surface area instead of by historical proposal.
- Keep implementation details in Architecture, not in Product.

## Non-Goals

- Preserve historical specs for unsupported or removed flows.
- Duplicate low-level implementation notes already covered elsewhere.
- Treat draft ideas as roadmap commitments.

## Overview

Product docs are now organized by the surfaces users interact with:

- **CLI** for project, ticket, session, template, and workspace operations.
- **Dashboard** for documentation, tickets, ticket detail, sessions, and settings.
- **Platform** for cross-cutting behavior such as templates, skills, sync, and releases.
- **API** for user-visible operational behavior such as error logging.

## Users

| User / Segment | Need | Current Workaround |
| -------------- | ---- | ----------------- |
| Contributors | Find the current supported workflow quickly. | Read code or guess from CLI help. |
| Maintainers | Keep behavior docs aligned with shipped surfaces. | Manually cross-check old spec pages. |
| Coding agents | Use docs as current product truth when updating features. | Infer behavior from scattered source files. |

## Requirements

### Functional Requirements

1. Product docs must describe currently shipped behavior, not planned behavior.
2. Unsupported or placeholder flows must be called out explicitly instead of documented as complete features.
3. Product docs must live under `.pstdio/docs/product`.

### UX Requirements

- Navigation should make it obvious where to find docs for each surface area.
- Readers should be able to start from Product and branch into CLI, Dashboard, Platform, or API.

### Operational Requirements

- Architecture, Known Issues, Lessons Learned, and Contributing remain separate sections.
- When a surface changes materially, its Product page should change in the same PR.

## Behavior

1. Start in Product docs to understand what Prompt Studio currently does.
2. Follow links into Architecture when the implementation model matters.
3. Use Known Issues and Lessons Learned for exceptions, defects, and historical failures.

## Interface

| Area | Coverage |
| ---- | -------- |
| `/product/cli` | Command groups, workflows, and command-level constraints. |
| `/product/dashboard/*` | Current dashboard routes and panel behavior. |
| `/product/platform/*` | Shared product mechanics such as templates, skills, sync, and releases. |
| `/product/api/*` | Operational API behavior with product impact. |

## Rules & Constraints

- Legacy `specs` pages are intentionally removed to prevent drift.
- Product docs describe behavior; Architecture describes implementation.
- If a UI route is still a placeholder, the Product doc should say so.

## Risks & Open Questions

- Product docs will drift again if behavior changes land without doc updates.
- Some surfaces still expose placeholders; docs should be revisited as those routes become real features.

## Verification & Evidence

- **Commands to run**: `find .pstdio/docs/product -type f | sort`, `sed -n '1,220p' .pstdio/docs/navigation.json`
- **Expected evidence**: A `Product` section in navigation and only PRD-style docs under `.pstdio/docs/product`.
- **Where to find artifacts**: `.pstdio/docs/navigation.json`, `.pstdio/docs/product/`
