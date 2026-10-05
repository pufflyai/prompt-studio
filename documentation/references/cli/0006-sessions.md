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
