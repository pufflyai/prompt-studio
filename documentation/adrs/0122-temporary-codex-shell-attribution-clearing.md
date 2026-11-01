# Temporary Codex shell attribution clearing

Proposed: 2026-10-13

Status: Accepted for PS-688.

## Intended design

Each native Codex thread receives its host session and optional project identity. A host-only thread has no project identity. Unrelated user shell policy remains intact.

## External limitation

Codex 0.160.0 merges per-thread `shell_environment_policy.set` tables with lower config layers. Omitting a key does not remove a value from user config. A live PS-688 shell probe retained a stale project ID in a host-only thread despite removing that key from the override and the shared server environment. Exclusions run before `set`, so excluding that variable cannot remove the configured value either.

The native config API has no supported per-thread key-removal operation for this table. Replacing user config or changing process-wide policy would affect unrelated threads and user values.

## Temporary decision

Always override both host attribution keys. Use the actual host ID when present and an empty string when absent. The CLI treats a blank project value as unspecified. This prevents stale config attribution while preserving other shell settings.

Keep this behavior inside the Codex thread-config adapter. It adds no stored state, setting, public API, or compatibility path. The shell environment contains a blank project variable rather than an absent one for host-only sessions. This is an attribution rule, not an environment security boundary.

## Removal

Remove the empty-value clearing when supported Codex releases provide per-thread deletion or complete replacement of the shell `set` table. Repeat native probes with stale IDs in inherited environment and user config, including host-only sessions, concurrent threads, and cold resume. Keep the clearing until all supported versions pass those probes without it.
