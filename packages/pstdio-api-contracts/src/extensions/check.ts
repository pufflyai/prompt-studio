import { z } from "zod";
import {
  extensionFileIconThemeRecordSchema,
  extensionThemeRecordSchema,
  extensionTranslationRecordSchema,
} from "./appearance";
import { extensionArtifactMountSchema } from "./artifacts";
import { extensionHookRecordSchema, extensionMiddlewareRecordSchema, extensionScheduleRecordSchema } from "./commands";
import { extensionHostCompatibilitySchema } from "./host-capabilities";
import { extensionViewLikeSchema } from "./panels";
import { workbenchExtensionMetadataSchema } from "./workbench-metadata";

export type { WorkbenchExtensionMetadata, WorkbenchExtensionViewRecord } from "./workbench-metadata";
export { workbenchExtensionMetadataSchema } from "./workbench-metadata";

const checkWorkbenchMetadataSchema = workbenchExtensionMetadataSchema.pick({
  extensions: true,
  commands: true,
  menuContributions: true,
  commandPaletteContributions: true,
  modes: true,
  views: true,
  viewMenus: true,
  placements: true,
  resourceKinds: true,
  resourceViews: true,
  resourceHierarchyProviders: true,
  navigationItems: true,
  statusBarItems: true,
  statuses: true,
  activityItems: true,
  settingsSections: true,
  settingsPanels: true,
  commandPaletteResources: true,
  keybindings: true,
  settingsDefinitions: true,
  diagnostics: true,
});

export const extensionsCheckResponseSchema = checkWorkbenchMetadataSchema.extend({
  extensionsRoot: z.string(),
  extensionsRootExists: z.boolean(),
  errorCount: z.number().int().nonnegative(),
  warningCount: z.number().int().nonnegative(),
  middlewares: z.array(extensionMiddlewareRecordSchema),
  hooks: z.array(extensionHookRecordSchema),
  schedules: z.array(extensionScheduleRecordSchema),
  artifactMounts: z.array(extensionArtifactMountSchema),
  themes: z.array(extensionThemeRecordSchema),
  fileIconThemes: z.array(extensionFileIconThemeRecordSchema),
  templates: z.array(extensionViewLikeSchema),
  skills: z.array(extensionViewLikeSchema),
  hostCompatibility: extensionHostCompatibilitySchema,
});

export const listExtensionCommandsResponseSchema = z.object({
  commands: workbenchExtensionMetadataSchema.shape.commands,
  translations: z.array(extensionTranslationRecordSchema).optional(),
  diagnostics: workbenchExtensionMetadataSchema.shape.diagnostics,
});

export const listExtensionAppearanceResponseSchema = z.object({
  themes: z.array(extensionThemeRecordSchema),
  fileIconThemes: z.array(extensionFileIconThemeRecordSchema),
  translations: z.array(extensionTranslationRecordSchema),
  diagnostics: workbenchExtensionMetadataSchema.shape.diagnostics,
});

export type ExtensionsCheckResponse = z.infer<typeof extensionsCheckResponseSchema>;
export type ListExtensionCommandsResponse = z.infer<typeof listExtensionCommandsResponseSchema>;
export type ListExtensionAppearanceResponse = z.infer<typeof listExtensionAppearanceResponseSchema>;
