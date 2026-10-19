# Synchronized automations

The platform catalog `pstdio.automations` stores one explicit target per schedule:
workbench, environment, and local workspace. Use `pst extensions automations assign
<full-schedule-id> --workspace-id <id>` on the target runtime. Assignment does not
publish an extension or grant relay access. Publish its immutable extension revision
through the publication workflow first. Unassigned schedules from a published
automation extension stay idle. Unassigned, unpublished schedules keep their local behavior.

Targets, schedule identities, and assignment dates are immutable. The relay checks
those rules independently of the authoring host. There is no fallback workspace,
retargeting, failover, handoff, or hosted execution in v0.1. An unavailable workspace
or sleeping runtime does not move execution to another environment. Published
schedules and explicit local overrides still use normal extension context APIs.

Only relay-accepted assignments may open admission. A local pending disable can
close it early; a pending enable cannot open it. A shared publication disable also
closes schedule admission when received, even if package activation has failed.
`pst extensions automations list` exposes the saved definition, its observed revision,
and `delivery: pending` until the target's application acknowledgment reaches the
reader. Offline relay acceptance alone does not mean the target applied a disable.
Use `enable` or `disable` with the observed `--expected-revision` for a global
schedule switch. The publication switch still disables the whole automation extension.

The scheduler rechecks admission immediately before dispatch. Receiving a disable
stops new dispatches and retains active work until it finishes. The active command
keeps its captured runtime snapshot. A disable never cancels its sessions or processes.
Application acknowledgments confirm enforcement of admission, not command completion,
package readiness, or online availability.

The local `pstdio.automation-runs` journal records each occurrence before command code
can have effects. Its stable run identity contains workbench ID, full schedule ID,
and scheduled UTC minute. The same ID appears in command metadata and runtime activity.
The occurrence claim and cursor commit together. Duplicate notifications and restarts
cannot redispatch a claimed occurrence. If a runtime stops after a claim, its retained
`started` record does not prove external effects finished; it is never retried automatically.

On wake, startup, or a later cron callback, missed occurrences are recorded as `skipped`.
They are never executed as catch-up. The next live occurrence resumes the schedule.
`pst extensions automations runs` reads only the selected runtime's history. Run claims,
working directories, sessions, processes, credentials and development overrides remain
local. The relay carries definitions and application acknowledgments, not execution state.

The host routes are `GET/POST /v1/projects/{projectId}/automation-targets` and
`GET /v1/projects/{projectId}/automation-targets/runs`. The Docker checks are
`bun run --cwd packages/pstdio-api test:automations`; relay target immutability runs
in `bun run --cwd infra/relay test:storage`. Packaged smoke coverage exercises the
compiled CLI, pending delivery, target immutability, and runtime restart. These checks
do not claim a released package or production activation.
