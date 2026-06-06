import type { ExtensionCommandPaletteContribution } from "@pstdio/sdk/api";
import type { ExtensionRuntime } from "../types/runtime";

/**
 * Flattens a runtime command's palette declarations into metadata records. Shared by the workbench
 * and API metadata builders so the contribution id scheme and field mapping stay identical across
 * both surfaces.
 */
export const toCommandPaletteContributions = (
  commands: ExtensionRuntime["commands"],
): ExtensionCommandPaletteContribution[] =>
  commands.flatMap((command) =>
    command.palette.map((palette, index) => ({
      id: `${command.id}.palette.${index}`,
      extensionId: command.extensionId,
      commandId: command.id,
      label: palette.label ?? command.title,
      group: palette.group,
      placement: palette.placement,
      icon: palette.icon,
      params: palette.params as Record<string, unknown> | undefined,
      when: palette.when as ExtensionCommandPaletteContribution["when"],
    })),
  );
