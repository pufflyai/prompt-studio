# Command line

Run your tools' actions from the terminal, so you, your scripts, and your agents can use them without the dashboard.

## What the command line gives you

`pst` starts Prompt Studio and manages projects, sessions, workspaces, and extensions. Each enabled tool can add its own commands. They are the same commands behind the tool's buttons and menus, with the same checks and the same saved data.

This matters most for agents. An agent can discover a tool's actions with `--help`, run one with explicit flags, read the result, and use it in its next step. It does not need to find a button on the screen.

## Use the command line

Run `pst` inside a linked project folder, one that has `.pstdio/config.json`. Tool commands come from the extensions enabled in that project. For example, with Planner enabled:

```sh
pst --help
pst pstdio.planner --help
pst pstdio.planner list-tickets
```

- `pst --help` lists the core command groups and the project's enabled tool namespaces. Tool namespaces appear only while the runtime is reachable.
- `pst <namespace> --help` lists a tool's commands. `pst <namespace> <command> --help` shows its flags and examples.
- A successful command prints its result as JSON. Add `--json` for the full response, and check `outcome.ok` before reading `outcome.value`.
- A failed or rejected command exits with code 1. A missing required flag fails before the command runs.
- From another folder, add `--project-id <project-id>` to target a project.
- Commands that stream output accept `--stream` and print one JSON line per chunk.

Core groups include `pst projects`, `pst agents`, `pst sessions`, `pst workspaces`, `pst extensions`, and `pst notifications`. The desktop app includes `pst`. Without the app, install it as described in [Install Prompt Studio](../getting-started/0001-install.md#install-only-the-command-line-tool).

Prompt Studio Skills includes a `pstdio` skill that teaches agents to use Prompt Studio and `pst`. Install it with `pst agents setup <agent-id>`.

## Make your tool's actions available

A tool command is available in `pst` only when its author sets `cli: true`. A button built only inside a custom webview is not a command, so it is not available from the terminal.

```ts
defineCommand({
  id: "add",
  title: "Add bookmark",
  description: "Save a title and URL in this project's bookmarks.",
  cli: true,
  params: bookmarkParams,
  async run(ctx, { title, url }) {
    // save the bookmark and return it
  },
});
```

The command becomes `pst <publisher>.<name> <command-id>`. Dots in the command ID become path segments, and `cli: { path, examples }` sets a custom path and help examples inside the tool's namespace. Each parameter becomes a kebab-case flag: `noteId` becomes `--note-id`, a boolean is `--archived` or `--archived=false`, and a list repeats its flag.

Return IDs and saved state from commands that change data, and add read or list commands so an agent can check the result.

## Learn more

- [CLI overview](../../references/cli/0001-overview.md) lists every core command.
- [Make actions CLI-ready](../extensions/0007-cli-ready-actions.md) shows the full authoring pattern.
- [CLI contributions](../../references/extensions/0003-command-and-process-api.md#cli-contributions) covers paths, flags, and results.
- [Remote automation](../../references/cli/0007-automation.md) explains scoped machine tokens.

*Updated at: 2026-11-22*
