# CLI: User Feedback & Help

Rules for how the CLI communicates with the user when commands are incomplete or incorrect.

---

## Missing Subcommand → Show Help

When a user invokes a **command group** without specifying a subcommand, the CLI prints the help text for that group instead of an error.

**Command groups:** `agents`, `projects`.

```
$ pstdio agents

pstdio agents [command]

Manage coding agents

Commands:
  pstdio agents list    List configured agents and their status
  pstdio agents setup   Set up agents for this project
  pstdio agents remove  Remove agents from project configuration
```

This applies to every command group in the CLI. Leaf commands (e.g. `close`, `tui`) that take no subcommands are not affected.

---

## Unknown or Invalid Command → Error + Help

When a user types an unknown command or provides invalid arguments, the CLI prints the error message followed by the relevant help text.

```
$ pstdio foo

Unknown command: foo

pstdio [command]

Commands:
  pstdio                   Start API and dashboard, then open in browser
  pstdio agents [command]  Manage coding agents
  pstdio projects [command]  Manage projects
  ...
```

---

## Rules for Adding New Command Groups

When adding a new command group:

1. Define the command with an **optional** positional: `"mygroup [command]"` (not `<command>`).
2. Do **not** use `demandCommand`.
3. In the handler (which fires when no subcommand is given), call `yargs.showHelp()`.
4. Capture the yargs instance from the `builder` function for use in the handler.

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
