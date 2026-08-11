import {
  type LayoutPersistenceAdapter,
  type WorkbenchModuleContext,
  workbenchCommandPaletteMenuPath,
} from "@pstdio/workbench";
import type { ResolvedWorkbenchExtensionMetadata } from "@/shared/extensions/extension-localization";
import { createExtensionLayoutCompatibility, reconcileExtensionLayout } from "./extension-layout-reconciliation";

const extensionLayoutCompatibilityKey = (projectId: string) => `dashboard.extensions:${projectId}`;

export const reconcileStoredExtensionLayouts = (input: {
  layoutPersistence: LayoutPersistenceAdapter | undefined;
  metadata: ResolvedWorkbenchExtensionMetadata;
  projectId: string;
}) => {
  const nextCompatibility = createExtensionLayoutCompatibility(input.metadata);
  const key = extensionLayoutCompatibilityKey(input.projectId);
  const previousCompatibility = input.layoutPersistence?.getCompatibilityMarker?.(key);
  if (previousCompatibility === nextCompatibility) return previousCompatibility;

  input.layoutPersistence?.transformLayouts?.(input.projectId, (layout) =>
    reconcileExtensionLayout({ layout, metadata: input.metadata, previousCompatibility }),
  );
  input.layoutPersistence?.setCompatibilityMarker?.(key, nextCompatibility);
  return previousCompatibility;
};

export const registerExtensionLayoutResetCommands = (input: {
  ctx: WorkbenchModuleContext;
  layoutPersistence: LayoutPersistenceAdapter | undefined;
  metadata: ResolvedWorkbenchExtensionMetadata;
  projectId: string;
}) =>
  input.metadata.extensions.flatMap((extension) => {
    const commandId = `dashboard.extensions.resetLayout.${extension.id}`;
    return [
      input.ctx.commands.registerCommand(
        {
          id: commandId,
          label: `Reset ${extension.displayName || extension.name || extension.id} layout`,
        },
        {
          execute: () => {
            input.layoutPersistence?.transformLayouts?.(input.projectId, (layout) =>
              reconcileExtensionLayout({ layout, metadata: input.metadata, resetExtensionId: extension.id }),
            );
            input.layoutPersistence?.advanceWriteGeneration?.();
            input.ctx.layout.restoreLayout(
              reconcileExtensionLayout({
                layout: input.ctx.layout.getLayout(),
                metadata: input.metadata,
                resetExtensionId: extension.id,
              }),
            );
          },
        },
      ),
      input.ctx.layout.registerMenuItem(workbenchCommandPaletteMenuPath, {
        commandId,
        group: "Extensions",
      }),
    ];
  });
