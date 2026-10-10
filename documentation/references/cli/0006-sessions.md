# Sessions

A session is one agent conversation and the work it does. It runs in the project's default workspace or in another workspace.

## Commands

```sh
pst sessions create --prompt <text> [options]
pst sessions list [options]
pst sessions view --id <session-id>
pst sessions follow-up --id <session-id> [options]
pst sessions stream --id <session-id>
pst sessions approve --id <session-id> --approval-id <approval-id>
pst sessions deny --id <session-id> --approval-id <approval-id>
pst sessions stop --id <session-id>
pst sessions archive --id <session-id>
pst sessions resolve-session-id --agent <agent-id> --agent-session-id <external-id> [--cwd <path>] [--json]
```

## Create a session

Provide `--prompt`. Prompt templates belong to extensions. To use one, render it through its extension first, then pass the result as the prompt.

```sh
pst sessions create --prompt "Review this repository" --agent pstdio.harness-codex.harness.codex --model <model>
pst sessions create --prompt "Review this workspace" --workspace-id <workspace-id>
```

Other create options are `--title`, `--project-id`, `--attach` (repeat it for more files), and `--original-session-id` (the session that started this one).

## Continue a session

`follow-up` accepts `--prompt`, or `--summary-of` to send a summary of another session. It also accepts `--agent`, `--model`, and repeated `--attach` options.

```sh
pst sessions follow-up --id <session-id> --prompt "Run the focused tests"
pst sessions follow-up --id <session-id> --summary-of <source-session-id> --summary-format detailed --summary-role all
```

`--summary-format` accepts `brief` (the default) or `detailed`. `--summary-role` accepts `assistant` (the default) or `all`.

## Inspect and control sessions

`list` can filter by `--project-id`, `--status`, `--agent`, and `--workspace-id`. Add `--archived` to include archived sessions.

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
