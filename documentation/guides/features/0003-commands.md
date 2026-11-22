# Commands

A command is an action that you or your agent can run, such as creating a report, importing feedback, or publishing an update.

## What commands give you

A command is one operation with typed inputs and a result. The same command can run from a button, a menu, search, the terminal, a schedule, or another tool. People and agents use the same operation, with the same checks, and see the same saved result.

A button that only exists inside a custom view is not a command. An agent cannot run it.

## Use commands in Prompt Studio

- **Search.** Press **Mod+P** (Cmd+P on macOS, Ctrl+P elsewhere) to find commands from Prompt Studio and your tools. Commands with a keyboard shortcut show it as a hint.
- **Buttons and menus.** Toolbar buttons, row menus, and selection actions in a tool run its commands. A command with inputs opens a form built from them.
- **The terminal.** Tools can expose commands through `pst`. See [Command line](0008-command-line.md).

Because every route runs the same command, a change made from the terminal also appears in the tool's open views when the tool announces it with a refresh event.

## Add a command to your tool

Declare a command with `defineCommand` and list it in `defineExtension({ commands })`:

```ts
import { defineCommand } from "@pstdio/sdk/extensions";
import { defineExtension, params } from "@pstdio/sdk/extensions";

export default defineExtension({
  commands: [
    defineCommand({
      id: "publish",
      title: "Publish release",
      description: "Create release notes and run the publish workflow.",
      cli: true,
      params: {
        version: params.text({ label: "Version" }),
      },
      async run(_ctx, commandParams) {
        return { ok: true, version: commandParams.version };
      },
    }),
  ],
});
```

- `params` declares the inputs. The dashboard builds forms from them, and `pst` turns them into flags.
- `cli: true` makes the command available as `pst <publisher>.<name> <command-id>`.
- `palette` adds the command to search. Toolbar and row actions point to the command with `command: <command>.ref`.
- `automation: true` lets a scoped machine token run the command for remote automation. It is separate from `cli`.

Put the real work, such as checks and storage writes, in `run`. Return the saved state, including IDs, so the caller can use it in the next step. Add read or list commands when an agent needs to check what exists.

Other parts of the extension API build on commands. Middleware checks a command before it runs, hooks can react when it completes, and schedules run it at set times.

## Learn more

- [Commands and processes](../../references/extensions/0003-command-and-process-api.md#commands) lists command options, parameter types, and outcomes.
- [Make actions CLI-ready](../extensions/0007-cli-ready-actions.md) connects a tool's buttons to its commands.
- [Write an extension](../extensions/0001-authoring.md#4-add-commands) builds commands step by step.
- [Durable work](../../references/extensions/0007-durable-automation.md) runs commands that take longer than a request.

*Updated at: 2026-11-22*
