# Sessions

Use `pst sessions fork --id <session-id>` to copy a settled conversation into an independent session in the same workspace. The copy preserves its history, agent, model, and parameters and waits for a new prompt. Add `--message-id <message-id>` to include history only through the selected agent reply. The command prints the new session. The harness must support native forking. With `--message-id`, later running or queued work continues in the source. Without it, finish or stop pending work first.

A session is one agent conversation and the work it does. It runs in the project's default workspace or in another workspace.

## Commands

```sh
pst sessions create --prompt <text> [options]
pst sessions list [options]
pst sessions view --id <session-id>
pst sessions follow-up --id <session-id> [options]
pst sessions fork --id <session-id>
pst sessions import --source <backup-folder> --dry-run
pst sessions import --source <backup-folder> --project-map <mapping.json> [--storage <folder>]
pst sessions imports status --id <import-id>
pst sessions imports pause --id <import-id>
pst sessions imports resume --id <import-id>
pst sessions imports errors --id <import-id> [--offset <n>] [--limit <n>]
pst sessions stream --id <session-id>
pst sessions approve --id <session-id> --approval-id <approval-id>
pst sessions deny --id <session-id> --approval-id <approval-id>
pst sessions stop --id <session-id>
pst sessions archive --id <session-id>
pst sessions resolve-session-id --agent <agent-id> --agent-session-id <external-id> [--cwd <path>] [--json]
```

## Import saved conversations

Agents can restore history from the JSONL export created when a pre-0.46 database was retired. `--source` accepts the backup folder, its `export` folder, or its `tables` folder. It must contain `public.sessions.jsonl` and `public.files.jsonl` in the selected tables directory. Raw databases and database archives are not accepted.

```sh
pst sessions import --source /backups/pre-0.46-backup --dry-run
```

The preview returns JSON with source project IDs, session counts, recoverable histories, and up to 100 error samples. It creates no live sessions or files. Supply `--storage /path/to/original/storage` if conversation and attachment bytes are outside the backup. Paths identify files on the API host; the project-map file is read by the CLI. The importer confines file reads to the declared backup/storage roots.

Create a JSON file mapping selected source project IDs to existing destination project IDs:

```json
{
  "old-project-id": "current-project-id"
}
```

```sh
pst sessions import --source /backups/pre-0.46-backup --storage /backups/storage --project-map mapping.json
pst sessions imports status --id <import-id>
pst sessions imports errors --id <import-id> --offset 0 --limit 100
pst sessions imports pause --id <import-id>
pst sessions imports resume --id <import-id>
```

Import returns a durable job immediately. `phase: preparing` indexes file metadata on disk and reports `indexedFiles`; `phase: importing` copies one conversation at a time. One import runs per host. Pause finishes the current conversation or cancels preparation. Interrupted jobs appear paused after restart and resume only when requested.

Titles, original creation/update dates, archived state, messages, attachments, and agent/model settings are preserved. Session and file IDs are new; the same source session ID mapped to the same destination project always resolves to the same imported session. Repeated imports skip that existing session without modifying it. Imported sessions use the destination's default workspace when one exists. Previous native conversation IDs, queued work, and lifecycle hooks are not restored; old active statuses become cancelled.

Missing/corrupt histories fail per session while healthy rows continue. Failure pages return `nextOffset` for the next request. Repair missing bytes, then resume a completed job with failures to start another pass; already restored sessions are skipped. Counters describe the current pass, while resuming a paused pass retains its counts and cursor. If exported tables change, the resumed job fails before copying more sessions; start a new import for that revised export.

Resume rebuilds the temporary metadata index and checks the exported tables' fingerprint. Memory is bounded by the file-index batch plus the largest individual transcript and its attachment references, rather than all conversation histories. A staging ledger removes unfinished uploads after process interruption and preserves files belonging to committed sessions. Backups are never modified.

## Create a session

Provide `--prompt`. Prompt templates belong to extensions. To use one, render it through its extension first, then pass the result as the prompt.

```sh
pst sessions create --prompt "Review this repository" --agent pstdio.harness-codex.harness.codex --model <model>
pst sessions create --prompt "Review this workspace" --workspace-id WS-1
```

`--workspace-id` accepts a workspace ID or a [workspace shorthand](0005-workspaces.md), such as `WS-1` for a standalone workspace or `PS-12_A1` for the first Planner attempt at ticket `PS-12`.

Other create options are `--title`, `--project-id`, `--attach` (repeat it for more files), and `--original-session-id` (the session that started this one).

### Run on another device (unreleased)

For a Cloud project, `--device <device-id>` starts the session on one of your online devices. Read IDs with `pst devices list`. Workspace IDs and shorthands are resolved on the selected device.

```sh
pst sessions create --device <device-id> --workspace-id WS-1 --prompt "Run the focused tests"
```

The session stays on that device. Once its history appears here, ordinary `follow-up`, `approve`, `deny`, and `stop` commands target the device that owns it. Attachment bytes travel with the encrypted session action and are imported on the target during submission. A stop interrupts only that session's turn and preserves the conversation; it does not stop the device or its workspace.

The complete remote action has a 64 MiB encoded input limit, including the prompt and all attachments after base64 encoding. Each file still has the normal 25 MiB upload limit. For example, two 25 MiB files exceed the combined encoded limit; send fewer or smaller files. An oversized action is rejected before transfer or target execution.

The target must be online. Commands are never saved for delivery after reconnecting. If the connection is lost after submission, inspect the session before sending the same action again.

## Continue a session

`follow-up` accepts `--prompt`, or `--summary-of` to send a summary of another session. It also accepts `--agent`, `--model`, and repeated `--attach` options.

```sh
pst sessions follow-up --id <session-id> --prompt "Run the focused tests"
pst sessions follow-up --id <session-id> --summary-of <source-session-id> --summary-format detailed --summary-role all
```

`--summary-format` accepts `brief` (the default) or `detailed`. `--summary-role` accepts `assistant` (the default) or `all`.

### Steer active work

Add `--steer` to send the prompt into the current run without starting another turn:

```sh
pst sessions follow-up --id <session-id> --prompt "Focus on the tests first" --steer
pst sessions follow-up --id <session-id> --summary-of <source-session-id> --attach notes.txt --steer
```

The command captures the active run before uploading files. The host checks that run again before native delivery. Idle sessions, unsupported harnesses, open questions or approvals, and changed runs fail without queuing the prompt. `--agent` and `--model` cannot be combined with `--steer`; live input uses the current execution settings.

Submitted live requests print a JSON outcome with `status` set to `accepted`, `rejected`, or `uncertain`. Acceptance exits with code 0. Rejection, uncertainty, and unavailable steering exit unsuccessfully. Uncertain delivery includes a `deliveryId` and retains the prompt and attachments as held delivery evidence. A lost HTTP response can also mean delivery is uncertain. Inspect the conversation and `sessions queue` before taking another action; never automatically retry.

Without `--steer`, follow-up dispatch and queue behavior is unchanged. The separate `sessions steer` command below sends a request that is already saved in the queue.

## Inspect and control sessions

`list` can filter by `--project-id`, `--status`, `--agent`, and `--workspace-id`. Add `--archived` to include archived sessions.

Add `--json` to print the complete session records as a JSON array, including full session IDs and statuses. It works with the same filters and prints `[]` when no sessions match. Without `--json`, the command prints a table.

```sh
pst sessions list --json
pst sessions list --status in_progress --json
pst sessions list --status awaiting_input --json
```

Use `stream` to follow live output in the terminal. When the agent asks for permission to use a tool, pass the session ID and the approval request ID to `approve` or `deny`. `stop` ends a running session. `archive` hides a session from the default list.

`resolve-session-id` finds the Prompt Studio session for a session ID from the agent itself, such as a Claude Code session ID. `--cwd` picks the right one when the same external ID appears in more than one working folder.

Run `pst sessions <command> --help` for current options.

## Read and change queued requests

Use `pst sessions queue --id SESSION` to read saved requests, their revisions, and the active run identity.

`pst sessions update-queued --id SESSION --queue-position POSITION --expected-revision REVISION --prompt TEXT` saves without sending. Optional `--model MODEL`, `--params '{"thinking":"high"}'`, and `--attachments '[{"file_id":"FILE"}]'` update those fields. Use an empty model string for the provider default, JSON null for default parameters, and an empty attachment array to clear references.

`pst sessions combine-queued --id SESSION --target-position TARGET --source-position SOURCE --target-revision TARGET_REVISION --source-revision SOURCE_REVISION` combines compatible pending follow-ups atomically.

`pst sessions steer --id SESSION --queue-position POSITION --expected-revision REVISION --expected-run-started-at RUN` uses native live input when supported. It prints a typed outcome and exits nonzero for rejection or uncertain delivery. Never automatically retry an uncertain result.

### Time and anchor filters

`sessions list` accepts `--created-from`, `--created-to` and `--updated-from` with inclusive ISO timestamps. Use `--anchor-type` and `--anchor-id` together to select sessions attached to a resource. These combine with the existing status, agent, workspace and archive filters.

```sh
pst sessions list --agent claude-code --created-from 2026-10-01T00:00:00.000Z
pst sessions list --anchor-type ticket --anchor-id <ticket-id>
```

The HTTP `GET /sessions` endpoint accepts `created_from`, `created_to`, `updated_from`, `anchor_type` and `anchor_id`. It still returns an array, now ordered newest first. Items include `workspace_id` and nullable `usage_json` token totals. Extension commands use the same database filters through `ctx.sessions.query()`.

*Updated at: 2026-11-05*
