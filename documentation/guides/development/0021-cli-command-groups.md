# CLI command groups

Contributor procedure retained from the retired CLI feedback PRD. Product output behavior is governed by RB13 in the [canonical book](../../requirement-book/book.json).

Define every group with `defineCommandGroup` from `packages/pstdio/src/adapters/cli/command-group.ts`:

```ts
export const { command, describe, subcommands, builder, handler } = defineCommandGroup(
  { name: "mygroup", describe: "Manage my things" },
  subA,
  subB,
);
```

The helper declares the optional `[command]` positional, prints the group help for a bare group, and rejects an unknown subcommand. The CLI reads `subcommands` to find group paths, so a bare group never starts the API. Pass subcommand modules as arguments, not in an array: knip only counts a namespace import's exports as used when the namespace is passed to a call. Do not use `demandCommand` or a hand-written `showHelp` handler.
