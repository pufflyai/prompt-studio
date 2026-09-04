import type { NavigationTarget as ExtensionNavigationTarget } from "@pstdio/sdk/extensions";
import type { ExtensionKeybindingRecord } from "pstdio-api-contracts";
import type { WorkbenchModuleContext } from "../../core";
import { toWorkbenchNavigationTarget } from "./extension-navigation-target";
import { metadataCommandId } from "./workbench-extension-metadata-ref";

type KeybindingPlatform = keyof NonNullable<ExtensionKeybindingRecord["platformOverrides"]>;

const currentPlatform = (): KeybindingPlatform | undefined => {
  if (typeof navigator === "undefined") return undefined;
  const platform = `${navigator.platform} ${navigator.userAgent}`.toLowerCase();
  if (platform.includes("mac")) return "mac";
  if (platform.includes("win")) return "win";
  if (platform.includes("linux")) return "linux";
  return undefined;
};

export const resolveExtensionKeybindingChord = (binding: ExtensionKeybindingRecord, platform = currentPlatform()) =>
  (platform ? binding.platformOverrides?.[platform] : undefined) ?? binding.key;

export const registerWorkbenchExtensionKeybindings = (input: {
  bindings: ExtensionKeybindingRecord[];
  createWhenExpression?: (when: ExtensionKeybindingRecord["when"]) => string | undefined;
  workbench: WorkbenchModuleContext;
}) =>
  input.bindings.map((binding) =>
    input.workbench.keybindings.registerKeybinding({
      action: toWorkbenchNavigationTarget(binding.action as ExtensionNavigationTarget, {
        commandIdOf: (command) =>
          command.extensionId ? metadataCommandId({ extensionId: command.extensionId, id: command.id }) : undefined,
      }),
      keybinding: resolveExtensionKeybindingChord(binding),
      when: input.createWhenExpression?.(binding.when),
    }),
  );
