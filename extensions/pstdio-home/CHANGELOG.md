# pstdio-home

## 0.2.1

_2026-11-14_

### Patch Changes

- 86bbbef: Keep sessions and navigation within reach: refresh session pins without waiting for unrelated resources, open resource and collection pages by dragging, reopen closed tabs, and preview complete shortcuts in open menus. Add project-tab settings actions, compact Cloud status, fix retained Home reads and editor toolbars, and show nonempty linked-resource groups with relationships discoverable from either end. Expose session links through a right panel menu that follows attached and floating sessions and hides when empty; keep session navigation focused on conversations and keep the Side launcher floating above Main. Deliver streaming refresh events immediately and hide empty chat attachment trays.
- b510245: Prepare bundled extensions for API 0.5 without dropping their existing host ranges, and return Planner, Reports and Artifacts paths and links using the host-provided owner.

  Use publisher-qualified Planner and Reports commands in shipped skills, prompts, help examples and documentation so agent instructions also work after the API 0.5 shortcut removal.

  Keep ticket page ancestry and fresh draft ignore rules on the host-provided owner, including timeline rows, pulls and workspace provisioning.

## 0.2.0

_2026-11-12_

### Minor Changes

- 5c1e728: Provide the existing project Home page as a default project-local extension using public navigation, recently opened resources with session status, and setup recovery. Each project owns editable Home source under `.pstdio/extensions/pstdio-home/`; setup preserves its customizations.

### Patch Changes

- 5ae8e80: Update the About panel tagline to "A workbench for your agents."
- 8184397: Refresh Home when returning to its retained view.
- fd5af30: Pin React and React DOM to exactly 19.2.4 in extension manifests and lockfiles.
- 96415ed: Install the Sessions provider by default and use its public navigation refs, preserving legacy URLs and saved panels through the same native renderer.
- afd5581: Organize the Canvas catalog by purpose and consolidate navigable examples into fewer frames; make in-frame navigation the default for Canvas authoring.
- f26039d: Restore focused title editing, reliable retained notes, bounded presence avatars, Cloud connection and preparation feedback, pending conversations, and native menus that preserve drafts across floating and attached presentation.
- ed40a9d: Keep maintained extensions loadable across the existing and upcoming ordered-storage API hosts.
- ee368ab: Pause Home subscriptions while hidden and reload when returning to the view.
- b6975d0: Inspect native agent quotas through extension commands and show available quotas on Home with saved usage history from period start, full-width single charts or side-by-side windows with legends, automatic refresh, forecasts, and harness selection with names and icons. Bound Claude quota process-tree cleanup and keep OpenCode budget histories separate from Go windows.
