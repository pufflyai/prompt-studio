import {
  type LayoutPersistenceAdapter,
  type WorkbenchLayout,
  type WorkbenchModuleContext,
  workbenchCommandPaletteMenuPath,
} from "@pstdio/workbench";
import type { ResolvedWorkbenchExtensionMetadata } from "@/shared/extensions/extension-localization";
import { createExtensionLayoutCompatibility, reconcileExtensionLayout } from "./extension-layout-reconciliation";

const extensionLayoutCompatibilityKey = (projectId: string) => `dashboard.extensions:${projectId}`;
const alpha4IdentityMigrationKey = (projectId: string) => `dashboard.extensions:${projectId}:alpha4-identity`;
const alpha4IdentityMigrationMarker = "complete";
const dockedRegions = new Set(["sidenav", "main", "secondary", "side"]);

const alpha3IdentityMap = (metadata: ResolvedWorkbenchExtensionMetadata) => {
  const extensions = new Map(metadata.extensions.map((extension) => [extension.id, extension]));
  const identities = new Map<string, string>();
  for (const view of metadata.views) {
    const extension = extensions.get(view.extensionId);
    if (!extension) continue;
    const prefix = `${view.extensionId}.view.`;
    if (!view.id.startsWith(prefix)) continue;
    const localId = view.id.slice(prefix.length);
    for (const legacy of [
      `${extension.name}.${localId}`,
      `${extension.id}.${localId}`,
      `dashboard-workbench.extension-view.${extension.name}.${localId}`,
      `dashboard-workbench.extension-view.${extension.id}.${localId}`,
    ]) {
      identities.set(legacy, view.id);
    }
  }
  return identities;
};

const rewriteIdentity = (value: string | undefined, identities: ReadonlyMap<string, string>) => {
  if (!value) return value;
  const exact = identities.get(value);
  if (exact) return exact;
  for (const [legacy, current] of identities) {
    if (value.includes(legacy)) return value.replace(legacy, current);
  }
  return value;
};

export const migrateAlpha3ExtensionLayout = (
  layout: WorkbenchLayout,
  metadata: ResolvedWorkbenchExtensionMetadata,
): WorkbenchLayout => {
  const identities = alpha3IdentityMap(metadata);
  const regions = Object.fromEntries(
    Object.entries(layout.regions).map(([regionId, region]) => {
      if (!dockedRegions.has(regionId)) {
        return [regionId, { ...region, widgets: [], activeWidgetId: undefined }];
      }
      return [
        regionId,
        {
          ...region,
          widgets: region.widgets.map((placement) => ({
            ...placement,
            widgetId: rewriteIdentity(placement.widgetId, identities) ?? placement.widgetId,
            contributionId: rewriteIdentity(placement.contributionId, identities) ?? placement.contributionId,
            viewId: rewriteIdentity(placement.viewId, identities),
          })),
          activeWidgetId: rewriteIdentity(region.activeWidgetId, identities),
        },
      ];
    }),
  ) as WorkbenchLayout["regions"];
  return {
    ...layout,
    regions,
    activeWidgetId: rewriteIdentity(layout.activeWidgetId, identities),
    activeLocationWidgetId: rewriteIdentity(layout.activeLocationWidgetId, identities),
    locationSubPanelSelections: layout.locationSubPanelSelections
      ? Object.fromEntries(
          Object.entries(layout.locationSubPanelSelections).map(([key, selections]) => [
            rewriteIdentity(key, identities) ?? key,
            Object.fromEntries(
              Object.entries(selections).map(([region, id]) => [region, rewriteIdentity(id, identities)]),
            ),
          ]),
        )
      : undefined,
  };
};

export const reconcileStoredExtensionLayouts = (input: {
  layoutPersistence: LayoutPersistenceAdapter | undefined;
  metadata: ResolvedWorkbenchExtensionMetadata;
  projectId: string;
}) => {
  const migrationKey = alpha4IdentityMigrationKey(input.projectId);
  if (input.layoutPersistence?.getCompatibilityMarker?.(migrationKey) !== alpha4IdentityMigrationMarker) {
    input.layoutPersistence?.transformLayouts?.(input.projectId, (layout) =>
      migrateAlpha3ExtensionLayout(layout, input.metadata),
    );
    input.layoutPersistence?.setCompatibilityMarker?.(migrationKey, alpha4IdentityMigrationMarker);
  }
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
