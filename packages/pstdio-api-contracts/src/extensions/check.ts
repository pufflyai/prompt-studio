import { z } from "zod";
import {
  extensionFileIconThemeRecordSchema,
  extensionThemeRecordSchema,
  extensionTranslationRecordSchema,
} from "./appearance";
import { extensionArtifactMountSchema } from "./artifacts";
import {
  extensionCommandPaletteContributionSchema,
  extensionCommandRecordSchema,
  extensionHookRecordSchema,
  extensionMenuContributionSchema,
  extensionMiddlewareRecordSchema,
  extensionScheduleRecordSchema,
} from "./commands";
import { extensionDiagnosticSchema, extensionRecordSchema } from "./common";
import { extensionControlsRendererRecordSchema } from "./controls-renderer";
import { extensionDataTableRendererRecordSchema } from "./data-table-renderer";
import { extensionCommandPaletteResourceRecordSchema, extensionKanbanRendererRecordSchema } from "./kanban-renderer";
import { extensionKeybindingRecordSchema } from "./keybindings";
import {
  extensionModeRecordSchema,
  extensionNavigationRecordSchema,
  extensionPanelRecordSchema,
  extensionRouteRecordSchema,
  extensionTreeItemContributionSchema,
  extensionViewLikeSchema,
  workbenchExtensionPanelRecordSchema,
  workbenchExtensionRouteRecordSchema,
} from "./panels";
import { extensionFileRendererRecordSchema, extensionTreeRendererRecordSchema } from "./renderers";
import {
  extensionSettingDefinitionRecordSchema,
  extensionSettingsPanelRecordSchema,
  workbenchExtensionSettingsPanelRecordSchema,
} from "./settings";

export const extensionsCheckResponseSchema = z.object({
  extensionsRoot: z.string(),
  extensionsRootExists: z.boolean(),
  errorCount: z.number().int().nonnegative(),
  warningCount: z.number().int().nonnegative(),
  extensions: z.array(extensionRecordSchema),
  commands: z.array(extensionCommandRecordSchema),
  middlewares: z.array(extensionMiddlewareRecordSchema),
  hooks: z.array(extensionHookRecordSchema),
  schedules: z.array(extensionScheduleRecordSchema),
  artifactMounts: z.array(extensionArtifactMountSchema),
  themes: z.array(extensionThemeRecordSchema),
  fileIconThemes: z.array(extensionFileIconThemeRecordSchema),
  menuContributions: z.array(extensionMenuContributionSchema),
  commandPaletteContributions: z.array(extensionCommandPaletteContributionSchema),
  modes: z.array(extensionModeRecordSchema),
  panels: z.array(extensionPanelRecordSchema),
  routes: z.array(extensionRouteRecordSchema),
  navigation: z.array(extensionNavigationRecordSchema),
  treeItems: z.array(extensionTreeItemContributionSchema),
  settingsPanels: z.array(extensionSettingsPanelRecordSchema),
  kanbanRenderers: z.array(extensionKanbanRendererRecordSchema),
  dataTableRenderers: z.array(extensionDataTableRendererRecordSchema).optional(),
  commandPaletteResources: z.array(extensionCommandPaletteResourceRecordSchema),
  treeRenderers: z.array(extensionTreeRendererRecordSchema),
  fileRenderers: z.array(extensionFileRendererRecordSchema),
  controlsRenderers: z.array(extensionControlsRendererRecordSchema),
  keybindings: z.array(extensionKeybindingRecordSchema),
  settingsDefinitions: z.array(extensionSettingDefinitionRecordSchema).optional(),
  templates: z.array(extensionViewLikeSchema),
  skills: z.array(extensionViewLikeSchema),
  diagnostics: z.array(extensionDiagnosticSchema),
});

export const workbenchExtensionMetadataSchema = z.object({
  extensions: z.array(extensionRecordSchema),
  commands: z.array(extensionCommandRecordSchema),
  menuContributions: z.array(extensionMenuContributionSchema),
  commandPaletteContributions: z.array(extensionCommandPaletteContributionSchema).optional(),
  modes: z.array(extensionModeRecordSchema),
  panels: z.array(workbenchExtensionPanelRecordSchema),
  routes: z.array(workbenchExtensionRouteRecordSchema),
  navigation: z.array(extensionNavigationRecordSchema),
  treeItems: z.array(extensionTreeItemContributionSchema).optional(),
  settingsPanels: z.array(workbenchExtensionSettingsPanelRecordSchema),
  kanbanRenderers: z.array(extensionKanbanRendererRecordSchema).optional(),
  dataTableRenderers: z.array(extensionDataTableRendererRecordSchema).optional(),
  commandPaletteResources: z.array(extensionCommandPaletteResourceRecordSchema).optional(),
  treeRenderers: z.array(extensionTreeRendererRecordSchema).optional(),
  fileRenderers: z.array(extensionFileRendererRecordSchema).optional(),
  controlsRenderers: z.array(extensionControlsRendererRecordSchema).optional(),
  keybindings: z.array(extensionKeybindingRecordSchema).optional(),
  settingsDefinitions: z.array(extensionSettingDefinitionRecordSchema).optional(),
  diagnostics: z.array(extensionDiagnosticSchema),
});

export const listExtensionCommandsResponseSchema = z.object({
  commands: z.array(extensionCommandRecordSchema),
  translations: z.array(extensionTranslationRecordSchema).optional(),
  diagnostics: z.array(extensionDiagnosticSchema),
});

export const listExtensionAppearanceResponseSchema = z.object({
  themes: z.array(extensionThemeRecordSchema),
  fileIconThemes: z.array(extensionFileIconThemeRecordSchema),
  translations: z.array(extensionTranslationRecordSchema),
  diagnostics: z.array(extensionDiagnosticSchema),
});

export type ExtensionsCheckResponse = z.infer<typeof extensionsCheckResponseSchema>;
export type WorkbenchExtensionMetadata = z.infer<typeof workbenchExtensionMetadataSchema>;
export type ListExtensionCommandsResponse = z.infer<typeof listExtensionCommandsResponseSchema>;
export type ListExtensionAppearanceResponse = z.infer<typeof listExtensionAppearanceResponseSchema>;
