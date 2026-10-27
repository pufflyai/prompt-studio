import { defineKeybinding } from "@pstdio/sdk/extensions";
import { commands } from "./commands";
import { artifact } from "./resource-kinds";
export const artifactShortcuts = [
  defineKeybinding({
    id: "create-artifact",
    layer: "create",
    key: artifact.ref.id[0]!.toUpperCase(),
    action: { kind: "command", target: { command: commands["open-creation"].ref } },
  }),
  ...(
    [
      ["publish", "P", commands.publish],
      ["revisions", "V", commands.revisions],
    ] as const
  ).map(([id, key, command]) =>
    defineKeybinding({
      id: `current-${id}`,
      layer: "current",
      targetScope: "project",
      key,
      action: { kind: "command", target: { command: command.ref } },
    }),
  ),
  defineKeybinding({
    id: "current-rename",
    layer: "current",
    key: "R",
    targetScope: "resource",
    when: { resourceType: [artifact.ref] },
    action: { kind: "command", target: { command: commands["rename-resource"].ref } },
  }),
];
