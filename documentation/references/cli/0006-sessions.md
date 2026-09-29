---
status: "draft"
created: "2026-03-10T20:12:05Z"
---

# CLI sessions

A session records work performed by an agent. It can run at the project root or inside a workspace.

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

Provide `--prompt`. Templates belong to extensions; render any desired template through its owning extension before passing the resulting prompt.

```sh
pst sessions create --prompt "Review this repository" --agent pstdio.harness-codex.harness.codex --model <model>
pst sessions create --prompt "Review this workspace" --workspace-id <workspace-id>
```

Other create options are `--title`, `--project-id`, repeatable `--attach`, and `--original-session-id`.

## Continue a session

`follow-up` accepts `--prompt` or `--summary-of`, along with agent and model overrides and repeatable attachments.

```sh
pst sessions follow-up --id <session-id> --prompt "Run the focused tests"
pst sessions follow-up --id <session-id> --summary-of <source-session-id> --summary-format detailed --summary-role all
```

`--summary-format` accepts `brief` or `detailed`. `--summary-role` accepts `assistant` or `all`.

## Inspect and control sessions

`list` can filter by `--project-id`, `--status`, `--agent`, and `--workspace-id`. Add `--archived` to include archived sessions.

Use `stream` to follow live output. When an approval request appears, pass both the session ID and the approval request ID to `approve` or `deny`.

`resolve-session-id` maps an external harness session ID to a Prompt Studio session ID. `--cwd` breaks ties when the same external ID appears in more than one working directory.

Run `pst sessions <command> --help` for current options.
