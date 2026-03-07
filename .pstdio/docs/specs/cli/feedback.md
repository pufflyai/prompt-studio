# Feedback and Help

## Purpose

Define how the CLI communicates when commands are incomplete, unknown, or invalid.

---

## Missing Subcommand

### Trigger

User invokes a command group without a subcommand.

### Behavior

- Show group help text instead of throwing an error.
- Applies to command groups such as `agents` and `projects`.
- Does not apply to leaf commands that have no subcommands (for example, `close`).

### Example

```text
$ pstdio agents

pstdio agents [command]

Manage coding agents

Commands:
  pstdio agents list    List configured agents and their status
  pstdio agents setup   Set up agents for this project
  pstdio agents remove  Remove agents from project configuration
```

---

## Unknown or Invalid Command

### Trigger

User types an unknown command or invalid arguments.

### Behavior

- Print an error message.
- Then print the relevant help text.

### Example

```text
$ pstdio foo

Unknown command: foo

pstdio [command]

Commands:
  pstdio                     Start API and dashboard, then open in browser
  pstdio agents [command]    Manage coding agents
  pstdio projects [command]  Manage projects
  ...
```

---

## Rules for New Command Groups

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
