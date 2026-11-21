# pstdio-session-browser

## 0.3.0

_2026-11-21_

### Minor Changes

- 52fbda2: Use canonical first-party package names and concise Notes commands on migration-capable API 0.5 hosts. Remove declared global CLI shortcuts and use publisher-qualified Planner and Reports commands.
- cca9b29: Wait for supervisor quota resets and optionally restart limit-stopped conversations after a 15-second buffer, using durable delayed automation.
- f22e64b: Show new conversation activity consistently across rows and tabs after the person views the exact reply or question.

### Patch Changes

- 0f351e0: Add Copy session ID to session actions so session references can be shared with other agents.
- cca9b29: Keep background task lifecycle notices out of conversations, preserve OpenCode question choices and replies, and wait for harness readiness before sending an answer.
- 86bbbef: Keep sessions and navigation within reach: refresh session pins without waiting for unrelated resources, open resource and collection pages by dragging, reopen closed tabs, and preview complete shortcuts in open menus. Add project-tab settings actions, compact Cloud status, fix retained Home reads and editor toolbars, and show nonempty linked-resource groups with relationships discoverable from either end. Expose session links through a right panel menu that follows attached and floating sessions and hides when empty; keep session navigation focused on conversations and keep the Side launcher floating above Main. Deliver streaming refresh events immediately and hide empty chat attachment trays.
- de66f90: Hide session workspace information when Workspaces is unavailable and refresh open conversations when tools change.
- b510245: Prepare bundled extensions for API 0.5 without dropping their existing host ranges, and return Planner, Reports and Artifacts paths and links using the host-provided owner.

  Use publisher-qualified Planner and Reports commands in shipped skills, prompts, help examples and documentation so agent instructions also work after the API 0.5 shortcut removal.

  Keep ticket page ancestry and fresh draft ignore rules on the host-provided owner, including timeline rows, pulls and workspace provisioning.

- 468076b: Move resource pages between panels, keep resource creation in the receiving tabs, open resource links as Side previews, and unify Main page and tab headers.
- a0fb3f5: Keep action errors local and dismissible, show system notices in the status bar, and represent workspace readiness in the conversation controls.
- 7a29611: Configure an ordinary project default page and public resource openers; let tools own workspace presentation and remove the alpha presentation aliases.
- 324e652: Preserve shared project and document state while views switch or reopen, adopt retained read owners and scoped invalidation, and keep required saves and bounded recovery work with their domain owners.
- 7bfcc34: Show the running indicator beside active sessions in the navigation panel.
- 3979b1a: Show the command an agent wants to run when it asks for approval.
- 9694ebd: Define live session icons once on resource references and refresh them across Workbench.
- 226fbff: Record the next backend CPU spike with recent CPU profiles, database origins and timings, and chat encoding measurements in one bounded local export. Preserve completed recording windows if the backend is interrupted.

## 0.2.0

_2026-11-12_

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
