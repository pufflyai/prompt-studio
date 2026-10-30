---
user_prompt: "Prompt Studio should work cross platform"
status: "draft"
created: "2026-03-25T07:17:32.006Z"
---

# PRD: Cross-Platform Support

## Summary

Prompt Studio's CLI and runtime are tested on Windows, macOS, and Linux. The
release workflow builds, signs, and launches the native desktop applications
before it publishes them. A target needs passing packaged tests and trusted
installer signatures before release. [CI scope](#ci-scope) lists which platform
checks run for pull requests, the merge queue, and `main`.

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

**Current behavior:** `pstdio-paths` uses `HOME` when it is set and otherwise falls
back to `os.homedir()`. The Claude Code harness builds transcript paths from
`os.homedir()`. The Codex harness no longer reads session files: it recovers
history through the Codex app-server `thread/read` request (`native-history.ts`
and `codex-thread.ts`). The Codex process receives the runtime environment, so
the Codex CLI itself applies a `CODEX_HOME` override. That last point is inferred
from source, not tested.

**Required behavior:** use a native home-directory fallback for session paths and
preserve explicit agent home overrides.

**Affected locations:**

- `packages/pstdio-paths/src/index.ts`: runtime home
- `extensions/harness-claude-code/src/harness.ts`: transcript paths

### 3. Binary Detection

**Current behavior:** the harnesses use Bun executable discovery. Codex also
resolves Windows command wrappers (`extensions/harness-codex/src/codex-process.ts`).
Desktop resolves login-shell paths on POSIX and keeps the inherited environment on
Windows (`clients/desktop/src/runtime/runtime-environment.ts`).

**Required behavior:** installed agents on the user's Windows `PATH` are visible
to the desktop runtime, CLI, and harness selector. No separate `where` command or
Git Bash dependency is needed.

The packaged desktop test `clients/desktop/src/e2e/packaged-harness-detection.p2.spec.ts`
checks discovery from a directory containing spaces. It uses native executables on
Windows and login-shell setup on POSIX. `packages/e2e/src/packaged/harness-npm-detection.p2.test.ts`
checks npm command shims on `PATH`.

### 4. Path Separator Handling

**Current behavior:** Claude transcript lookup uses native path joining and
replaces non-alphanumeric project-path characters with hyphens, matching the
agent's directory encoding. Regression cases in `harness.p0.test.ts` cover Windows
drive paths, spaces, and network shares.

**Required behavior:** use `path.join()` and `path.sep` consistently. Where paths are sanitized for use as identifiers (e.g. project directory → filename), replace both `/` and `\`.

**Affected locations:**

- `extensions/harness-claude-code/src/harness.ts`: transcript directory encoding

### 5. Signal Handling

**Current behavior:** desktop and CLI request graceful runtime shutdown through
the authenticated `/runtime/shutdown` endpoint
(`packages/pstdio-api/src/features/runtime/routes.ts`). They do not depend on POSIX
signals for normal shutdown.

**Required behavior:** preserve the runtime ownership and active-work checks on
every platform. Test forced process exits separately from normal shutdown.

The stalled-runtime test (`clients/desktop/src/e2e/packaged-startup-recovery.p1.spec.ts`)
uses POSIX suspension signals or Microsoft's signed
[PsSuspend](https://learn.microsoft.com/sysinternals/downloads/pssuspend) tool on
Windows. Windows test runners must put `pssuspend64.exe` on `PATH`. The
`setup-windows-desktop-tests` action installs it and checks its signature before
the packaged suite. The production app does not use it.

## Requirements

### Functional Requirements

1. pstdio CLI commands execute without errors on Windows, macOS, and Linux.
2. Extension automation loads and executes correctly on all three platforms.
3. All filesystem path construction uses `path.join()` or `path.resolve()`, with no hardcoded separators.
4. Production code falls back to `os.homedir()` when no explicit home is set.
5. The API server shuts down gracefully on all platforms.

### Operational Requirements

- The release workflow builds and launches desktop distributions on native
  Linux x64, Apple Silicon macOS arm64, Intel macOS x64, and Windows x64 runners.
  The macOS jobs verify signing and notarization before publication. Windows
  verifies trusted signatures and timestamps on the app, runtime, installer,
  and update payload. Stable publication requires all four targets.
- Native CLI packages for Linux x64, Intel macOS x64, and Windows x64 are verified
  on their own runners before each `pstdio` release and after each push to `main`.
- Nightly releases build no Windows assets. Publication of a nightly needs the
  macOS and Linux targets only.

### CI scope

`.github/workflows/test-and-build.yml` runs one stage per event.
`scripts/ci/pull-request-ci-scope.ts` chooses the stage and its optional jobs.

| Stage | Trigger | Platform checks |
| --- | --- | --- |
| Pull request | `pull_request` without the `ci:full` label | Linux only. `static_checks` and `lint_and_test` run for the packages changed since the target branch. Database, relay, published-extension, license, Docker, and harness CLI jobs run only when the changed files need them. A change outside every package, other than Markdown, `design/`, or `LICENSE`, turns on all of these jobs. No native desktop or CLI build runs. |
| Merge queue | `merge_group` | The full stage, the same jobs as a push to `main`. Desktop builds are unsigned. |
| Full | Push to `main`, manual run, or a pull request with `ci:full` | Every job. This adds Windows unit, database, and npm-shim tests, a compiled Windows CLI, the Linux e2e, Canvas, and packaged suites, unsigned desktop source and packaged tests on Linux, Apple Silicon, and Windows, and `verify-packaged-toolchain.yml` on Linux, Intel macOS, and Windows. |

`ci_passed` is the required check. A pull request may skip jobs it does not need.
The merge queue and the full stage fail if any job is skipped. Signed builds, notarization, the Intel
desktop tests, and the Windows update check run only in `release-packages.yml`.

## Rules & Constraints

- Do not introduce a runtime dependency on Git Bash.
- Maintain backward compatibility with the `.pstdio` directory name on all platforms.

## Known Issues

- Native agent session creation and restoration still need manual validation
  before Windows desktop publication. Executable discovery alone does not prove
  authenticated agent sessions.
- Windows has no browser e2e lane. Windows coverage comes from unit, database,
  npm-shim, and desktop tests.

## Risks & Open Questions

- **Bun on Windows maturity.** Bun's Windows support is still evolving. Some Bun APIs (e.g. `Bun.spawn`, signal handling) may behave differently. Verify against the Bun version pinned in the project.
- **File permissions.** Unix file modes have no direct Windows equivalent. Extension modules do not require executable permission.

## Delivery record

Checked on 2026-10-18 against main commit `45580feb` and the workflow files on that
commit. The newest stable release is `pstdio@0.43.1`.

| Field | Record |
| --- | --- |
| Status | Partly delivered. Home resolution, binary detection, path encoding, graceful shutdown, and signed four-platform desktop releases are in place. Native agent sessions on Windows and Windows contributor setup remain open. |
| Implementation | See the affected locations above. The CI stages came with #1029 and later scope changes, most recently #1170, #1141, and #1146. Release gating came with #1031. |
| Availability | `pstdio@0.43.1` shipped signed desktop installers for macOS arm64 and x64, Linux x64, and Windows x64, plus CLI binaries for six targets. CI changes ship no product code. |
| Remaining work | Validate authenticated agent sessions on native Windows. Add Windows setup steps to the [development setup guide](../../guides/development/0001-setup.md). Decide whether Windows needs a browser e2e lane. |
| Evidence | Release assets listed on the `pstdio@0.43.1` GitHub release on 2026-10-18. CI behavior read from the workflow and scope script, not from a run log. Path and detection tests were read, not rerun. Linux path tests are not native platform evidence. |
