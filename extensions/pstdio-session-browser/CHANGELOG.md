# pstdio-session-browser

## 0.2.0

_2026-11-08_

### Minor Changes

- 96415ed: Keep existing workspace/device selection, readiness, diff and existing-session opening in the native workspace hub. Preserve global workspace creation outside the session composer.

### Patch Changes

- 96415ed: Keep initial session controls query-owned instead of persisting an unresolved blank harness as a selected setting.
- 96415ed: Keep forking beside individual messages rather than in the session dropdown, and allow the generic Side-panel bubble to open without the Sessions provider.

  Preserve Main command-palette session status colors and offer local message forks without preemptive harness capability gating; drafts and remote sessions do not expose fork.

  Apply installed navigation trees' default node expansion using provider-scoped IDs, while preserving later user collapse choices.

- 96415ed: Provide native session browsing and composition in pages and shared Side panels through an independently installed Sessions extension. Keep recent date groups and use the shared SDK message reducer without installing UI rendering dependencies in the backend provider.

  Cancel the Sessions live subscription when a refresh fails so its retained resources are released.

  Show workspace session rows by default when opening a workspace.
