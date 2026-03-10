## Setup

config.json

```sh
{
  "project_id": "118795c0-4abd-46bc-8888-0e59589c4e1f"
}
```

- `pstdio agents list` - Show known agents with their configuration and installation status.
- `pstdio agents setup <agent-id>` - Configure an agent (e.g. `claude-code`, `opencode`). First configured agent becomes the default.
- `pstdio agents remove <agent-id>` - Remove a configured agent. Reassigns default if needed.

> Configured agents determine into which folders skills are installed during project setup (e.g. `.claude/skills/`, `.opencode/skills/`). Agent configuration is stored in the DB via the API (`GET/POST /v1/agents`, `DELETE /v1/agents/:agentId`).

- `pstdio projects create [name]` - Create a new project and initialize it. If `name` is omitted, the current repo folder name is used.
- `pstdio projects link --project-id <project-id>` - Given an existing project with project-id, write `.pstdio/config.json` at the current git root (repo root or current git worktree root). Also scaffold `.pstdio/docs/navigation.json` and starter markdown (`.pstdio/docs/index.md`) / pull.

> projects create and projects link should also install the default pstdio skills.

> projects are initialized with the default templates

- `pstdio projects list`

## Tickets

- `pstdio tickets write --title <title> --template <template-name> --tag bug --tag proposal`

> add a ticket locally in `.pstdio/tickets` and create a ticket in the db set to draft=true. This allows the agent to edit the ticket file locally, before saving it.

- `pstdio tickets create --content <content> --<tag> <value>`

> create a new ticket in the db (doesn't set it up locally)

- `pstdio tickets push --id <ticket-shorthand> --tag bug --tag proposal`

> update the ticket in the db with the content of the local ticket with <ticket-shorthand>

- `pstdio tickets list --project-id <project-id>` - List all tickets in the current project context (or specify a project id)

- `pstdio tickets update --status <status-value> --tag <tag> ...` - update ticket properties, except content

- `pstdio tickets implement --id <ticket-shorthand>` - Move a ticket to status `wip` and launch agent.

## Templates

- `pstdio templates write --name <template-name> --target docs or <ticket-shorthand>`
- Bundled documentation templates: `prd`, `adr`, `cookbook`, `review-me`, `lessons-learned`

similar to tickets write
