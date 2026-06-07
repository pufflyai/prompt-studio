import type { ExtensionKeybindingContribution } from "@pstdio/sdk/api";
import type { ExtensionRuntime } from "../types/runtime";

/**
 * Maps runtime keybinding records onto the API contract shape, shared by API and workbench
 * metadata builders so the dashboard sees the same fields no matter where the metadata is
 * served from.
 */
export const toKeybindingContributions = (
  keybindings: ExtensionRuntime["keybindings"],
): ExtensionKeybindingContribution[] =>
  keybindings.map((keybinding) => ({
    id: keybinding.id,
    extensionId: keybinding.extensionId,
    commandId: keybinding.commandId,
    key: keybinding.key,
    chordId: keybinding.chordId,
    mac: keybinding.mac,
    linux: keybinding.linux,
    win: keybinding.win,
    args: keybinding.args,
    when: keybinding.when as ExtensionKeybindingContribution["when"],
  }));
