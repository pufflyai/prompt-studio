import { defineKeybinding } from "@pstdio/sdk/extensions";
import { commands } from "./commands";
import { libraryTarget } from "./contracts";
import { artifact } from "./resource-kinds";

export const artifactShortcuts = [
  defineKeybinding({ id: "go-library", layer: "go", key: "A", sticky: true, action: libraryTarget }),
  defineKeybinding({
    id: "create-artifact",
    layer: "create",
    key: "A",
    action: { kind: "command", target: { command: commands["start-creation"].ref } },
  }),
  defineKeybinding({ id: "extension-open", layer: "extensions", key: "O", sticky: true, action: libraryTarget }),
  ...(
    [
      ["new", "N", commands["start-creation"]],
      ["publish", "P", commands.publish],
      ["revisions", "V", commands.revisions],
    ] as const
  ).map(([id, key, command]) =>
    defineKeybinding({
      id: `extension-${id}`,
      layer: "extensions",
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
