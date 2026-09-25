---
user_prompt: "Prompt Studio should work cross platform"
status: "draft"
created: "2026-03-25T07:17:32.006Z"
---

# Cross-Platform Support

## Summary

Prompt Studio's CLI and runtime are tested on Windows, macOS, and Linux. Desktop
CI also builds and launches the native Intel macOS and Windows applications.
Publication remains separate from these development checks: a target needs
passing packaged tests and trusted installer signatures before release.

## Problem

Remaining platform concerns include:

- Extension automation may spawn processes that rely on Unix-specific tools.
- Harness transcript paths must use the native user home when `HOME` is absent.
- Windows desktop inherits the user's executable search path. It does not read POSIX shell startup files.
- Harness-specific path encodings need to match the agent's native format.

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

**Current behavior:** `pstdio-paths` resolves the runtime home with an `os.homedir()`
fallback. Claude and Codex transcript paths also resolve the native home. Codex
preserves its explicit `CODEX_HOME` override.

**Required behavior:** use a native home-directory fallback for session paths and
preserve explicit agent home overrides.

**Affected locations:**

- `extensions/harness-claude-code/src/harness.ts` — transcript paths
- `extensions/harness-codex/src/rollout.ts` — session paths

### 3. Binary Detection

**Current behavior:** the harnesses use Bun executable discovery. Codex also
resolves Windows command wrappers. Desktop resolves login-shell paths on POSIX
and keeps the inherited environment on Windows.

**Required behavior:** installed agents on the user's Windows `PATH` are visible
to the desktop runtime, CLI, and harness selector. No separate `where` command or
Git Bash dependency is needed.

The packaged harness test checks discovery from a directory containing spaces.
It uses native executables on Windows and login-shell setup on POSIX.

### 4. Path Separator Handling

**Current behavior:** Claude transcript lookup uses native path joining and
replaces non-alphanumeric project-path characters with hyphens, matching the
agent's directory encoding. Regression cases cover Windows drive paths, spaces,
and network shares.

**Required behavior:** use `path.join()` and `path.sep` consistently. Where paths are sanitized for use as identifiers (e.g. project directory → filename), replace both `/` and `\`.

**Affected locations:**

- `extensions/harness-claude-code/src/harness.ts` — transcript directory encoding

### 5. Signal Handling

**Current behavior:** desktop and CLI request graceful runtime shutdown through
the authenticated `/runtime/shutdown` endpoint. They do not depend on POSIX
signals for normal shutdown.

**Required behavior:** preserve the runtime ownership and active-work checks on
every platform. Test forced process exits separately from normal shutdown.

The stalled-runtime test uses POSIX suspension signals or Microsoft's signed
[PsSuspend](https://learn.microsoft.com/sysinternals/downloads/pssuspend) tool on
Windows. Windows test runners must put `pssuspend64.exe` on `PATH`; CI installs
and verifies it before the packaged suite. The production app does not use it.

## Requirements

### Functional Requirements

1. pstdio CLI commands execute without errors on Windows, macOS, and Linux.
2. Extension automation loads and executes correctly on all three platforms.
4. All filesystem path construction uses `path.join()` or `path.resolve()` — no hardcoded separators.
5. Home directory is resolved via `os.homedir()` in all production code paths.
6. The API server shuts down gracefully on all platforms.

### Operational Requirements

- CI builds and launches desktop distributions on native Linux x64, Apple
  Silicon macOS arm64, Intel macOS x64, and Windows x64 runners. The macOS release job verifies signing and
  notarization before publication. Intel macOS desktop distribution is deferred.
  Windows desktop distribution is deferred until its trusted signing lane is
  available. Intel macOS and Windows CLI validation remains active.

## Rules & Constraints

- Do not introduce a runtime dependency on Git Bash.
- Maintain backward compatibility with the `.pstdio` directory name on all platforms.

## Known Issues

- Native agent session creation and restoration still need manual validation
  before Windows desktop publication. Executable discovery alone does not prove
  authenticated agent sessions.

## Risks & Open Questions

- **Bun on Windows maturity.** Bun's Windows support is still evolving. Some Bun APIs (e.g. `Bun.spawn`, signal handling) may behave differently. Verify against the Bun version pinned in the project.
- **File permissions.** Unix file modes have no direct Windows equivalent. Extension modules do not require executable permission.

## Rollout Plan

1. **Phase 1 — Home directory and binary detection** (highest impact): replace `process.env.HOME` usage, fix binary detection. Add Windows CI lane for unit tests.
2. **Phase 2 — Path handling and signals**: audit and fix remaining path separator issues. Guard signal handlers. Add Windows CI lane for e2e tests.
3. **Phase 3 — Documentation**: add a "Windows Setup" section to the contributing guide.
