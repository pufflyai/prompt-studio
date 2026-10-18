---
status: "draft"
created: "2026-03-10T20:12:05Z"
---

# PRD: CLI feedback and help

This page defines how the CLI responds to missing subcommands, unknown commands, and invalid arguments.

## Missing subcommand

User invokes a command group without a subcommand.

- Show group help text on stdout and exit 0 instead of throwing an error.
- Do not start or require the API. This also holds when automatic API start is disabled.
- Applies to command groups such as `agents`, `projects`, and `auth tokens`.
- Does not apply to leaf commands that have no subcommands (for example, `close`).

```text
$ pst agents

pstdio agents [command]

Manage coding agents

Commands:
  pstdio agents list                       List available coding harnesses
  pstdio agents setup <agent-id>           Configure an agent and install
                                           missing skills
  pstdio agents install-skills <agent-id>  Install missing skills for an agent
                                           and keep existing skill folders
```

## Unknown command or invalid arguments

User types an unknown command, an unknown subcommand, or invalid arguments.

- Print the error on stderr. An unknown command or subcommand prints `Unknown argument: <name>`.
- Then print the relevant help text: root help for an unknown command, the group's help for an unknown subcommand.
- Exit with code 1.

### Example

```text
$ pst agents bogus

Unknown argument: bogus

pstdio agents [command]

Manage coding agents

Commands:
  pstdio agents list                       List available coding harnesses
  ...
```

## Complete output

Command output reaches its reader in full, whether stdout is a terminal, a file, or a pipe. A `--json` result larger than 64 KiB stays valid JSON when piped through a slow reader such as `tee`. The CLI waits for pending output before it exits. The current mechanism is a temporary workaround for a Bun limitation; see [ADR 0081](../../adrs/0081-temporary-cli-console-stream-binding.md).

## Rules for new command groups

Define every group with `defineCommandGroup` from `packages/pstdio/src/adapters/cli/command-group.ts`:

```ts
export const { command, describe, subcommands, builder, handler } = defineCommandGroup(
  { name: "mygroup", describe: "Manage my things" },
  subA,
  subB,
);
```

The helper declares the optional `[command]` positional, prints the group help for a bare group, and rejects an unknown subcommand. The CLI reads `subcommands` to find group paths, so a bare group never starts the API. Pass subcommand modules as arguments, not in an array: knip only counts a namespace import's exports as used when the namespace is passed to a call. Do not use `demandCommand` or a hand-written `showHelp` handler.

## Delivery record

Checked on 2026-10-18 against main commit `45580feb` and this branch's uncommitted source. The newest stable release is `pstdio@0.43.1`.

| Field | Record |
| --- | --- |
| Status | Delivered in source on this branch. Not on `main` and not released. |
| Implementation | `packages/pstdio/src/adapters/cli/command-group.ts` (`defineCommandGroup` and `commandGroupPaths`), used by all 12 group modules under `packages/pstdio/src/adapters/cli/commands/`, including `resources`, which no longer uses `demandCommand`. Complete piped output: `packages/pstdio/src/features/cli-output.ts`, installed by the CLI entry point under ADR 0081. |
| Availability | In `pstdio@0.43.1` and on `main`, a bare group can exit 1 without help when automatic API start is disabled, and piped `console.log` output can stop at 65,536 bytes. Neither fix is released. |
| Remaining work | Merge and release. Remove the ADR 0081 binding when its removal condition is met. |
| Evidence | Integration tests, passed locally on 2026-10-18 against this branch: `packages/e2e/src/cli/feedback.test.ts` (15 tests: bare-group help offline for 12 groups, unknown subcommand and unknown command errors with help and exit code) and `packages/e2e/src/cli/piped-output.test.ts` (2 tests). |
