---
status: "draft"
created: "2026-03-10T20:12:05Z"
---

# CLI feedback and help

This page defines how the CLI responds to missing subcommands, unknown commands, and invalid arguments.

## Missing subcommand

User invokes a command group without a subcommand.

- Show group help text instead of throwing an error.
- Applies to command groups such as `agents` and `projects`.
- Does not apply to leaf commands that have no subcommands (for example, `close`).

```text
$ pst agents

pst agents [command]

Manage coding agents

Commands:
  pst agents list            List configured agents and their status
  pst agents setup           Set up an agent for this project
  pst agents install-skills  Install enabled skills for an agent
```

## Unknown command or invalid arguments

User types an unknown command or invalid arguments.

- Print an error message.
- Then print the relevant help text.

### Example

```text
$ pst foo

Unknown command: foo

pst [command]

Commands:
  pst                     Start API and dashboard, then open in browser
  pst agents [command]    Manage coding agents
  pst projects [command]  Manage projects
  ...
```

## Rules for new command groups

1. Define the group with an optional positional, for example `"mygroup [command]"` (not `<command>`).
2. Do not use `demandCommand`.
3. In the handler (fires when no subcommand is passed), call `yargs.showHelp()`.
4. Capture the yargs instance from `builder` for use in the handler.

```ts
let _yargs: Argv;

export const builder = (yargs: Argv) => {
  _yargs = yargs;
  return yargs.command(subA).command(subB);
};

export const handler = () => {
  _yargs.showHelp();
};
```
