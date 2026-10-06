# Remote Workspaces Extension Rules

These rules are for contributors and agents who change this extension in the Prompt Studio repository. The [extension rules](../AGENTS.md) apply too.

## Local development

- Follow Prompt Studio's isolated Docker workflow: start the host with `bun run dev:isolated`.
- Watch changes against that host with `PSTDIO_HOME="$HOME/.pstdio-dev" pst extensions dev ./extensions/remote-workspaces`.

## Checks

```sh
bun test extensions/remote-workspaces
bun run --cwd extensions/remote-workspaces typecheck
bun run verify:translations
bun run validate
```

## PocketCoder adapter

- The adapter uses PocketCoder's workspace API, the AgentAPI `/message`, `/messages`, and `/status` relay routes, and the durable `/conversation` history.
- It polls complete transcript snapshots once per second.
- PocketCoder has no idempotent turn IDs. The turn cursor workaround is recorded in [ADR 0022](../../documentation/adrs/0022-temporary-pocketcoder-turn-cursor.md). Keep it isolated. Remove it when PocketCoder exposes idempotent turn submission and turn lookup.
- See PocketCoder's [HTTP API](https://github.com/pufflyai/pocketcoder/blob/main/docs/api.md) and [deployment guide](https://github.com/pufflyai/pocketcoder/blob/main/docs/deployment.md).
