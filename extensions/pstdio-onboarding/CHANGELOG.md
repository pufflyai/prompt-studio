# pstdio-onboarding

## 0.3.1

_2026-11-27_

### Patch Changes

- 958363f: Keep extensions available on the next host API while retaining compatibility with previously supported hosts.
- 962fa6d: Update i18next and Claude Code to patched releases and require Claude Code 2.1.251 or newer.

## 0.3.0

_2026-11-21_

### Minor Changes

- 52fbda2: Use canonical first-party package names and concise Notes commands on migration-capable API 0.5 hosts. Remove declared global CLI shortcuts and use publisher-qualified Planner and Reports commands.

### Patch Changes

- b510245: Prepare bundled extensions for API 0.5 without dropping their existing host ranges, and return Planner, Reports and Artifacts paths and links using the host-provided owner.

  Use publisher-qualified Planner and Reports commands in shipped skills, prompts, help examples and documentation so agent instructions also work after the API 0.5 shortcut removal.

  Keep ticket page ancestry and fresh draft ignore rules on the host-provided owner, including timeline rows, pulls and workspace provisioning.

- a0fb3f5: Keep action errors local and dismissible, show system notices in the status bar, and represent workspace readiness in the conversation controls.
- 3539553: Hide empty system notices and use normal widget controls, simplify extension navigation, keep GitHub internal, install Terminal for Coding, and remove Activity from Notes.
- aae2818: Offer a separate Skill Browser through Coding onboarding with automatic selection, extension groups, parameter-based Info, and native workbench header controls above Settings in the footer, and narrow the settings modal with properly spaced navigation groups.

## 0.2.0

_2026-11-12_

### Minor Changes

- 9924e18: Restore optional project onboarding so each new project can choose its agents and tools.

### Patch Changes

- afd5581: Organize the Canvas catalog by purpose and consolidate navigable examples into fewer frames; make in-frame navigation the default for Canvas authoring.
- ed40a9d: Keep maintained extensions loadable across the existing and upcoming ordered-storage API hosts.
- 706ab86: Keep Cloud and performance monitoring optional, install Workspaces through Coding setup, show Home and Onboarding as preinstalled, and remove duplicate Cloud status and settings headings.
