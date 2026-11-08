# pstdio-home

## 0.2.0

_2026-11-08_

### Minor Changes

- 5c1e728: Provide the existing project Home page as a default project-local extension using public navigation, recently opened resources with session status, and setup recovery. Each project owns editable Home source under `.pstdio/extensions/pstdio-home/`; setup preserves its customizations.

### Patch Changes

- 8184397: Refresh Home when returning to its retained view.
- 96415ed: Install the Sessions provider by default and use its public navigation refs, preserving legacy URLs and saved panels through the same native renderer.
- afd5581: Organize the Canvas catalog by purpose and consolidate navigable examples into fewer frames; make in-frame navigation the default for Canvas authoring.
- ed40a9d: Keep maintained extensions loadable across the existing and upcoming ordered-storage API hosts.
- ee368ab: Pause Home subscriptions while hidden and reload when returning to the view.
