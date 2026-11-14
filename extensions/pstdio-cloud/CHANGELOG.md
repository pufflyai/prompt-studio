# pstdio-cloud

## 0.2.1-nightly.20261114030224

_2026-11-14_

### Patch Changes

- 2cd2f7d: Show source and file sync activity and allow safely retrying one Cloud source.
- 86bbbef: Keep sessions and navigation within reach: refresh session pins without waiting for unrelated resources, open resource and collection pages by dragging, reopen closed tabs, and preview complete shortcuts in open menus. Add project-tab settings actions, compact Cloud status, fix retained Home reads and editor toolbars, and show nonempty linked-resource groups with relationships discoverable from either end. Expose session links through a right panel menu that follows attached and floating sessions and hides when empty; keep session navigation focused on conversations and keep the Side launcher floating above Main. Deliver streaming refresh events immediately and hide empty chat attachment trays.
- b510245: Prepare bundled extensions for API 0.5 without dropping their existing host ranges, and return Planner, Reports and Artifacts paths and links using the host-provided owner.

  Use publisher-qualified Planner and Reports commands in shipped skills, prompts, help examples and documentation so agent instructions also work after the API 0.5 shortcut removal.

  Keep ticket page ancestry and fresh draft ignore rules on the host-provided owner, including timeline rows, pulls and workspace provisioning.

## 0.2.0

_2026-11-12_

### Minor Changes

- c4aaecb: Add Cloud status, account settings and device controls through the bundled Cloud extension.

### Patch Changes

- 49d4b5e: Use the shared UI resolver's `user-round-key` icon for Prompt Studio Cloud sign-in and update the Canvas Cloud previews.
- 8fd1a28: Restore Cloud status when a hidden panel returns while an older account read is still pending.
- fd5af30: Pin React and React DOM to exactly 19.2.4 in extension manifests and lockfiles.
- f26039d: Restore focused title editing, reliable retained notes, bounded presence avatars, Cloud connection and preparation feedback, pending conversations, and native menus that preserve drafts across floating and attached presentation.
- 706ab86: Keep Cloud and performance monitoring optional, install Workspaces through Coding setup, show Home and Onboarding as preinstalled, and remove duplicate Cloud status and settings headings.
