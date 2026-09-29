---
status: "current"
created: "2026-03-10T20:12:05Z"
---

# PRD: Dashboard settings and folder projects

## Purpose

Users can open a project folder and use its tools without first configuring an agent. Settings expose host runtime controls and project-scoped extension, folder, skill, and template settings through the shared workbench settings surface.

## Settings surface

Settings open in the workbench overlay. Dashboard contributions register sections, panels, and collection editors; there is no separate route-owned settings application. Runtime is the default panel and remains reachable without a selected project.

| Scope | Panels |
| --- | --- |
| Global | Runtime; Experimental → Beta features |
| Project | Extensions, Project folder, Skills, Templates, Machine tokens, Danger zone |

Extensions can contribute settings through public APIs. Template editors call commands declared by the owning extension. Ticket statuses and tags belong to Planner; core does not own a generic ticket-settings page.

## Folder requirements

1. Opening a folder must not require an agent-selection step or an installed harness executable.
2. An existing folder reopens its project. New folders establish one default workspace owner.
3. Existing projects stay accessible when an agent is unavailable.
4. Project folder settings show the default workspace location, support project rename, and allow attaching a location when one is missing.
5. The host must enforce one active root workspace per folder, including upgraded data. See [projects and workspaces](../../references/architecture/0015-projects.md).

## Runtime settings

- `max_concurrent_sessions` is global. An empty limit means unlimited concurrency.
- Active capacity includes `in_progress` and `awaiting_input`; queued sessions do not consume a slot.
- Lowering the limit must not cancel active sessions. It affects later dispatches.
- Increasing capacity allows queued sessions to drain.
- Errors saving settings must be visible, and connected clients receive settings changes through sync.

## Extension and agent boundaries

The Extensions panel manages installed sources and project instances, including enablement, settings, contributions, connections, and available automation controls. Static contributions and installed source state must be inspected independently of a currently open view.

Agents are harness contributions from enabled extensions. The core does not maintain the old `agent_configs` table or an Agents settings panel for manually editing executable paths. Use [agent CLI commands](../../references/cli/0002-agents.md) and the [harness architecture](../../references/architecture/0002-agents.md) for discovery and setup.

## Skills, templates, and credentials

Skills show content and installation information. Templates resolve through extension-owned providers and retain user overrides. Machine tokens are scoped credentials for automation; connection secrets stay in the host-managed secret boundary. Settings pages must not expose credentials as ordinary extension settings or webview state.

Global preferences survive project deletion. Deleting one project's data must not reset installation-wide runtime or beta preferences.

## Verification

Use [manual Playwright validation](../../guides/development/0001-setup.md#playwright-validation) with isolated state. Open settings without a project, then with a project. Check folder opening without an installed agent, scope changes between projects, runtime limit updates, and persistence after reopening.

Implementation owners:

- [Settings registration](../../../packages/pstdio-dashboard/src/modules/settings/settings-contributions.tsx)
- [Settings module](../../../packages/pstdio-dashboard/src/modules/settings/module.tsx)
- [Settings API](../../../packages/pstdio-api/src/features/settings/routes.ts)
- [Session queue](../../references/architecture/0018-session-queue.md)
