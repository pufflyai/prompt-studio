# harness-claude-code

## 0.3.5

_2026-08-13_

### Patch Changes

- Updated internal dependencies: `@pstdio/sdk@0.17.0`

## 0.3.4

_2026-07-28_

### Patch Changes

- 3acfedb: Add configurable harness run parameters, dynamic provider-qualified model catalogs with model-specific thinking levels, concrete model defaults, and isolated dev seeding.
- Updated internal dependencies: `@pstdio/sdk@0.16.0`

## 0.3.3

_2026-07-09_

### Patch Changes

- ab0193c: Rename bundled core extensions to Prompt Studio labels and stabilize provision hooks.
- Updated internal dependencies: `@pstdio/sdk@0.15.0`

## 0.3.2

_2026-06-28_

### Patch Changes

- bdc672b: Stamp `createdAt` on initial user messages so Codex and Claude Code chat UIs show timestamps for user turns.
- Updated internal dependencies: `@pstdio/sdk@0.14.0`

## 0.3.1

_2026-06-23_

### Patch Changes

- 0ca1dca: Add prototype session attachments across CLI, dashboard, API queueing, and harness dispatch.
- 7a0f4e1: Fix chat session chrome and modal overlay regressions.
- Updated internal dependencies: `@pstdio/sdk@0.13.2`

## 0.3.0

_2026-06-14_

### Minor Changes

- 989ffbe: Declare the harness skills layout (.claude/skills for Claude Code, .agents/skills for OpenCode and Codex) so the host installs project skills per harness.

### Patch Changes

- Updated internal dependencies: `@pstdio/sdk@0.13.0`

## 0.2.0

_2026-06-11_

### Minor Changes

- bb253f4: New extension contributing the Claude Code agent harness (session start/resume, transcript-backed message history, approvals, model listing).

### Patch Changes

- Updated internal dependencies: `@pstdio/sdk@0.12.0`
