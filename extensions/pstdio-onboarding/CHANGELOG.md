# pstdio-onboarding

## 0.2.1

_2026-11-14_

### Patch Changes

- b510245: Prepare bundled extensions for API 0.5 without dropping their existing host ranges, and return Planner, Reports and Artifacts paths and links using the host-provided owner.

  Use publisher-qualified Planner and Reports commands in shipped skills, prompts, help examples and documentation so agent instructions also work after the API 0.5 shortcut removal.

  Keep ticket page ancestry and fresh draft ignore rules on the host-provided owner, including timeline rows, pulls and workspace provisioning.

## 0.2.0

_2026-11-12_

### Minor Changes

- 9924e18: Restore optional project onboarding so each new project can choose its agents and tools.

### Patch Changes

- afd5581: Organize the Canvas catalog by purpose and consolidate navigable examples into fewer frames; make in-frame navigation the default for Canvas authoring.
- ed40a9d: Keep maintained extensions loadable across the existing and upcoming ordered-storage API hosts.
- 706ab86: Keep Cloud and performance monitoring optional, install Workspaces through Coding setup, show Home and Onboarding as preinstalled, and remove duplicate Cloud status and settings headings.
