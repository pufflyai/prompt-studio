---
status: "draft"
created: "2026-03-10T20:12:05Z"
---

# Product Requirements Document: CLI Feedback and Help

## Summary

This PRD documents how the CLI responds to missing subcommands, unknown commands, and invalid command usage.

## Detailed Behavior


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
$ pst agents

pst agents [command]

Manage coding agents

Commands:
  pst agents list    List configured agents and their status
  pst agents setup   Set up agents for this project
  pst agents remove  Remove agents from project configuration
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
$ pst foo

Unknown command: foo

pst [command]

Commands:
  pst                     Start API and dashboard, then open in browser
  pst agents [command]    Manage coding agents
  pst projects [command]  Manage projects
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
