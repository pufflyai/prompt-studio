# harness-claude-code

## 0.3.10

_2026-08-31_

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
