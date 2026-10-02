# harness-claude-code

## 0.40.0

_2026-10-02_

### Patch Changes

- 49a535c: Keep Claude Code running while it waits for its own background task, and report the result when the task ends.

## 0.39.0

_2026-09-30_

### Minor Changes

- 266e1fd: Declare the extension API as the caret range `^0.1.0` instead of a list of alpha versions.

### Patch Changes

- 0732e62: List Opus once in the Claude Code model picker when the Claude CLI reports both its default model and Opus.

## 0.38.0

_2026-09-29_

## 0.37.0

_2026-09-29_

### Patch Changes

- 9ef96aa: Declare compatibility with explicit navigation and resource removal on extension API alpha.14.
- c0dff06: Match thinking-level icons to planner priority colors and use a flame for Max.

## 0.36.1

_2026-09-28_

### Patch Changes

- a4f8c23: Ship a lockfile so installs download only runtime dependencies.

## 0.36.0

_2026-09-28_

### Patch Changes

- 42a6b1b: Declare conversation recovery and view dependencies for the next host API.
- 6efb4bf: Stop positional OpenCode message ids from moving a removed turn's attachments to another turn, and complete the host API alpha.12 migration.
- ccbf130: Require the SDK release that provides conversation recovery and view data events.

## 0.35.0

_2026-09-26_

### Patch Changes

- ffe4aa8: Fix native desktop runtime lifetime, extension loading and refresh, live table menus, and harness paths; defer diff and chart loading to speed up startup.

## 0.4.5

_2026-09-26_

### Patch Changes

- 20276db: Use consistent level bars for agent effort and default priorities while preserving customized tags during setup.

## 0.4.4

_2026-09-25_

### Patch Changes

- 659348b: Keep Claude and Codex sessions alive during quiet work and drain stderr to prevent process stalls.
- Updated internal dependencies: `@pstdio/sdk@0.25.0`

## 0.4.3

_2026-09-14_

### Patch Changes

- a4fa9de: Align extension Bun type definitions to 1.4.2.
- Updated internal dependencies: `@pstdio/sdk@0.24.1`

## 0.4.2

_2026-09-10_

### Patch Changes

- Updated internal dependencies: `@pstdio/sdk@0.24.0`

## 0.4.1

_2026-09-09_

### Patch Changes

- Updated internal dependencies: `@pstdio/sdk@0.23.0`

## 0.4.0

_2026-09-07_

### Minor Changes

- 99d8075: Revise workbench composition, package delivery, navigation, typed controls, and placement lifecycle across the extension API.

### Patch Changes

- c84459e: Define one contribution-ID grammar (lowercase kebab-case segments separated by dots), enforce it as an error in `pst extensions check`, resolve host-published refs without owner prefixing for every contribution kind, rename first-party ids to the grammar (extension API 1.0.0-alpha.6), and migrate stored automation scopes, runs, schedule and skill preferences to the renamed ids.
- 01911e8: Add typed workbench pages, panels, locations, regions, and navigation validation.
- 3bd3d7e: Support running pstdio from a source checkout on Windows: `.cmd` command wrappers, safe resolution and cmd.exe argument escaping for npm `.cmd`/`.bat`/`.ps1` shims, copied (not symlinked) extension files in the runtime cache, and hidden console windows.
- Updated internal dependencies: `@pstdio/sdk@0.22.0`

## 0.3.9

_2026-08-27_

### Patch Changes

- 5329cb7: Replace overlapping extension UI contracts with alpha.4 views, placements, navigation, and shared workflow statuses.
- 40e4fd6: Add provider-backed workspace creation.
- 545d925: Pass command and middleware parameters as the second handler argument across the extension API.
- 545d925: Add stable workbench views and migrate extension navigation.
- 82138c3: Update the Bun toolchain requirement to 1.3.14.
- Updated internal dependencies: `@pstdio/sdk@0.21.0`

## 0.3.8

_2026-08-25_

### Patch Changes

- Updated internal dependencies: `@pstdio/sdk@0.20.0`

## 0.3.7

_2026-08-24_

### Patch Changes

- Updated internal dependencies: `@pstdio/sdk@0.19.0`

## 0.3.6

_2026-08-21_

### Patch Changes

- de6a77b: Version the extension API as `1.0.0-alpha.1` and refuse extensions that declare a different version or a range.
- 62aedfb: Make composition the sole owner of panel placement and expose placement-aware panel queries.
- Updated internal dependencies: `@pstdio/sdk@0.18.0`

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
