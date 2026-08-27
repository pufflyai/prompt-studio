---
user_prompt: "Prompt Studio should work cross platform"
status: "draft"
created: "2026-03-25T07:17:32.006Z"
---

# Cross-Platform Support

## Summary

Prompt Studio currently assumes a Unix environment (macOS / Linux). It should run correctly on Windows so that teams with mixed OS environments can adopt it without friction.

## Problem

Several parts of the codebase use Unix-specific APIs and conventions that fail or behave incorrectly on Windows:

- Extension automation may spawn processes that rely on Unix-specific tools.
- Home directory resolution relies on `process.env.HOME`, which is undefined on Windows.
- Agent binary detection uses the `which` command, unavailable on Windows.
- Path construction hardcodes forward-slash separators in places.
- Signal handling uses `SIGTERM`, which Windows does not support in the same way.

Several CLI commands produce incorrect paths or crash on Windows.

## Goals

- pstdio CLI, API server, and extension automation run correctly on Windows, macOS, and Linux.
- Existing Unix users experience no regressions.
- Hook authoring remains simple — users should not need platform-specific boilerplate.

## Non-Goals

- MSI packaging; the desktop application uses a signed Squirrel installer.
- PowerShell-native extension authoring.
- Windows-specific UI shell integration (e.g. Explorer context menus).

## Overview

The changes fall into five areas, ordered by severity.

### 1. Extension Execution

**Current behavior:** extensions are TypeScript/JavaScript modules loaded by the extension runtime. This works cross-platform since Bun handles module loading on all platforms.

**Remaining concern:** extension handlers that spawn child processes may use Unix-specific commands. Extension authors should use cross-platform alternatives or guard platform-specific invocations.

### 2. Home Directory Resolution

**Current behavior:** several modules read `process.env.HOME` to locate `~/.pstdio` and session files. On Windows, `HOME` is typically undefined; the equivalent is `USERPROFILE`.

**Required behavior:** use `os.homedir()` (or Bun's equivalent) everywhere. It returns the correct directory on all platforms. Remove all direct reads of `process.env.HOME` for path construction.

**Affected locations:**

- `packages/pstdio-agents/src/providers/claude-code/claude-code.ts` — session log paths
- `packages/pstdio-api/src/features/tickets/endpoints/create-ticket-attempt.ts` — workspace base path
- Any other location that reads `HOME` for filesystem paths

### 3. Binary Detection

**Current behavior:** `spawnSync("which", [binary])` is used to check if agent binaries are installed.

**Required behavior:** use `spawnSync("where", [binary])` on Windows, or use a cross-platform helper.

**Affected locations:**

- `packages/pstdio/src/adapters/cli/commands/agents/list.ts`

### 4. Path Separator Handling

**Current behavior:** some path construction uses string concatenation with `/` or regex-replaces `/` in paths.

**Required behavior:** use `path.join()` and `path.sep` consistently. Where paths are sanitized for use as identifiers (e.g. project directory → filename), replace both `/` and `\`.

**Affected locations:**

- `packages/pstdio-agents/src/providers/claude-code/claude-code.ts` — path sanitization regex

### 5. Signal Handling

**Current behavior:** the API server and CLI register handlers for `SIGTERM` and `SIGUSR1` for graceful shutdown.

**Required behavior:** Windows does not deliver POSIX signals reliably. Guard signal registrations behind a platform check, or use an event-based shutdown mechanism (e.g. `process.on("exit")`, `process.on("beforeExit")`). On Windows, `SIGINT` (Ctrl+C) works — focus shutdown logic there.

**Affected locations:**

- `packages/pstdio-api/src/server.ts`
- `packages/pstdio-api/src/index.ts`
- `packages/pstdio/src/adapters/cli/commands/serve/serve-app.ts`
- `packages/pstdio/src/adapters/cli/commands/dashboard/index.ts`

## Requirements

### Functional Requirements

1. pstdio CLI commands execute without errors on Windows, macOS, and Linux.
2. Extension automation loads and executes correctly on all three platforms.
4. All filesystem path construction uses `path.join()` or `path.resolve()` — no hardcoded separators.
5. Home directory is resolved via `os.homedir()` in all production code paths.
6. The API server shuts down gracefully on all platforms.

### Operational Requirements

- CI builds and launches desktop distributions on native Linux x64, macOS arm64,
  and macOS x64 runners. The macOS release jobs verify signing and notarization
  before publication. Windows desktop distribution is deferred until its trusted
  signing lane is available; Windows CLI validation remains active.

## Rules & Constraints

- Do not introduce a runtime dependency on Git Bash.
- Maintain backward compatibility with the `.pstdio` directory name on all platforms.

## Known Issues

- **No known extension-specific issues.** Extensions are modules loaded by the extension runtime, which works cross-platform.

## Risks & Open Questions

- **Bun on Windows maturity.** Bun's Windows support is still evolving. Some Bun APIs (e.g. `Bun.spawn`, signal handling) may behave differently. Verify against the Bun version pinned in the project.
- **File permissions.** Unix file modes have no direct Windows equivalent. Extension modules do not require executable permission.

## Rollout Plan

1. **Phase 1 — Home directory and binary detection** (highest impact): replace `process.env.HOME` usage, fix binary detection. Add Windows CI lane for unit tests.
2. **Phase 2 — Path handling and signals**: audit and fix remaining path separator issues. Guard signal handlers. Add Windows CI lane for e2e tests.
3. **Phase 3 — Documentation**: add a "Windows Setup" section to the contributing guide.
