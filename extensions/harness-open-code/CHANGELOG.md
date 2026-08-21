# harness-open-code

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

- f0c6bbf: Fix OpenCode skill status guidance and interactive question responses
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

- Updated internal dependencies: `@pstdio/sdk@0.14.0`

## 0.3.1

_2026-06-23_

### Patch Changes

- 0ca1dca: Preserve session attachment file IDs in OpenCode transcript file parts.
- 0ca1dca: Add prototype session attachments across CLI, dashboard, API queueing, and harness dispatch.
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

- bb253f4: New extension contributing the OpenCode agent harness (server lifecycle, session polling, question replies, and reattach after host restarts).

### Patch Changes

- Updated internal dependencies: `@pstdio/sdk@0.12.0`
