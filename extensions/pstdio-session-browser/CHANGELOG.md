# pstdio-session-browser

## 0.2.0

_2026-11-11_

### Minor Changes

- 96415ed: Keep existing workspace/device selection, readiness, diff and existing-session opening in the native workspace hub. Preserve global workspace creation outside the session composer.

### Patch Changes

- a505761: Keep session date headings aligned with latest activity so duplicate rows cannot overlap or linger across navigation panels.
- f26039d: Restore focused title editing, reliable retained notes, bounded presence avatars, Cloud connection and preparation feedback, pending conversations, and native menus that preserve drafts across floating and attached presentation.
- 91b6eed: Install Sessions and Workspaces once per host user so they are available across that user's projects.
- 96415ed: Keep initial session controls query-owned instead of persisting an unresolved blank harness as a selected setting.
- 96415ed: Keep forking beside individual messages rather than in the session dropdown, and allow the generic Side-panel bubble to open without the Sessions provider.

  Preserve Main command-palette session status colors and offer local message forks without preemptive harness capability gating; drafts and remote sessions do not expose fork.

  Apply installed navigation trees' default node expansion using provider-scoped IDs, while preserving later user collapse choices.

- 3283189: Say when the agent is waiting for a reply while its background tasks keep running, and name those tasks.
- aed3de1: Load older sessions automatically while scrolling and keep date headings continuous across pages.
- 96415ed: Provide native session browsing and composition in pages and shared Side panels through an independently installed Sessions extension. Keep recent date groups and use the shared SDK message reducer without installing UI rendering dependencies in the backend provider.

  Cancel the Sessions live subscription when a refresh fails so its retained resources are released.

  Show workspace session rows by default when opening a workspace.
