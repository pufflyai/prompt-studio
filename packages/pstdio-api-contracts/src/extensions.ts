import { z } from "zod";

const jsonObjectSchema = z.record(z.string(), z.unknown());

export const extensionDiagnosticSeveritySchema = z.enum(["info", "warning", "error"]);

export const extensionDiagnosticSchema = z.object({
  code: z.string(),
  severity: extensionDiagnosticSeveritySchema,
  message: z.string(),
  extensionId: z.string().optional(),
  commandId: z.string().optional(),
  sourcePath: z.string().optional(),
  metadata: jsonObjectSchema.optional(),
});

export const extensionRecordSchema = z.object({
  id: z.string(),
  namespace: z.string(),
  displayName: z.string(),
  version: z.string().optional(),
  description: z.string().optional(),
  sourcePath: z.string(),
});

export const extensionCommandRecordSchema = z.object({
  id: z.string(),
  extensionId: z.string(),
  namespace: z.string(),
  title: z.string(),
  description: z.string().optional(),
  cliPath: z.string().optional(),
  examples: z.array(z.string()).optional(),
  excludeFromPalette: z.boolean().optional(),
  params: z.record(z.string(), z.object({ type: z.string() }).catchall(z.unknown())).optional(),
});

export const extensionMiddlewareRecordSchema = z.object({
  id: z.string(),
  extensionId: z.string(),
  commandId: z.string(),
});

export const extensionHookRecordSchema = z.object({
  id: z.string(),
  extensionId: z.string(),
  eventId: z.string(),
});

export const extensionScheduleRecordSchema = z.object({
  id: z.string(),
  extensionId: z.string(),
  cron: z.string(),
  commandId: z.string(),
});

export const extensionArtifactMountSchema = z.object({
  id: z.string(),
  extensionId: z.string(),
  namespace: z.string(),
  relativePath: z.string(),
  fullPath: z.string(),
  label: z.string(),
});

export const packageAssetDescriptorSchema = z.object({
  kind: z.literal("package-asset"),
  path: z.string(),
  baseUrl: z.string(),
});
export type PackageAssetDescriptor = z.infer<typeof packageAssetDescriptorSchema>;

export const extensionThemeRecordSchema = z.object({
  id: z.string(),
  extensionId: z.string(),
  namespace: z.string(),
  title: z.string(),
  description: z.string().optional(),
  format: z.literal("vscode-color-theme"),
  mode: z.enum(["light", "dark"]),
  source: packageAssetDescriptorSchema,
  tokens: z.record(z.string(), z.string()),
  monacoTheme: z.object({
    base: z.enum(["vs", "vs-dark"]),
    inherit: z.literal(true),
    rules: z.array(z.record(z.string(), z.unknown())),
    colors: z.record(z.string(), z.string()),
  }),
});

export const extensionFileIconThemeRecordSchema = z.object({
  id: z.string(),
  extensionId: z.string(),
  namespace: z.string(),
  title: z.string(),
  description: z.string().optional(),
  format: z.literal("vscode-file-icon-theme"),
  source: packageAssetDescriptorSchema,
  definitions: jsonObjectSchema,
  fileExtensions: z.record(z.string(), z.string()),
  fileNames: z.record(z.string(), z.string()),
});

const extensionPlacementSchema = z.enum(["first", "default", "last"]);
const extensionSlotKindSchema = z.enum(["menu", "navigation", "view", "settings", "renderer"]);

const extensionWebviewSchema = z.object({
  entry: packageAssetDescriptorSchema,
  title: z.string().optional(),
  sandbox: z.enum(["default", "strict"]).optional(),
  /** API-served URL for static HTML package assets mounted directly in an iframe. */
  assetUrl: z.string().optional(),
  /** API-served URL of the bridge runtime HTML the dashboard mounts in the iframe. */
  runtimeUrl: z.string().optional(),
  /** API-served URL of the bundled extension module the bridge runtime dynamically imports. */
  moduleUrl: z.string().optional(),
  /** API-served URLs of CSS files the bridge runtime should inject before mounting the module. */
  styles: z.array(z.string()).optional(),
});

export const extensionMenuContributionSchema = z.object({
  id: z.string(),
  extensionId: z.string(),
  commandId: z.string(),
  slotId: z.string(),
  label: z.string(),
  group: z.string().optional(),
  placement: extensionPlacementSchema.optional(),
  icon: z.string().optional(),
  presentation: z.enum(["menu-item", "button", "icon-button"]).optional(),
  params: jsonObjectSchema.optional(),
});

export const extensionViewRecordSchema = z.object({
  id: z.string(),
  extensionId: z.string(),
  slotId: z.string(),
  title: z.string(),
  group: z.string().optional(),
  placement: extensionPlacementSchema.optional(),
  webview: extensionWebviewSchema,
});

export const extensionRouteRecordSchema = z.object({
  id: z.string(),
  extensionId: z.string(),
  path: z.string(),
  label: z.string(),
  webview: extensionWebviewSchema,
});

export const extensionNavigationRecordSchema = z.object({
  id: z.string(),
  extensionId: z.string(),
  slotId: z.string(),
  label: z.string(),
  group: z.string().optional(),
  placement: extensionPlacementSchema.optional(),
  route: z.string().optional(),
  href: z.string().optional(),
  commandId: z.string().optional(),
  params: jsonObjectSchema.optional(),
  icon: z.string().optional(),
});

export const extensionSettingsPanelRecordSchema = z.object({
  id: z.string(),
  extensionId: z.string(),
  slotId: z.string(),
  title: z.string(),
  webview: extensionWebviewSchema,
});

export const extensionViewLikeSchema = z.object({
  id: z.string(),
  extensionId: z.string(),
});

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
  views: z.array(extensionViewRecordSchema),
  routes: z.array(extensionRouteRecordSchema),
  navigation: z.array(extensionNavigationRecordSchema),
  settingsPanels: z.array(extensionSettingsPanelRecordSchema),
  templates: z.array(extensionViewLikeSchema),
  skills: z.array(extensionViewLikeSchema),
  diagnostics: z.array(extensionDiagnosticSchema),
});

export const dashboardExtensionMetadataSchema = z.object({
  extensions: z.array(extensionRecordSchema),
  commands: z.array(extensionCommandRecordSchema),
  menuContributions: z.array(extensionMenuContributionSchema),
  views: z.array(extensionViewRecordSchema),
  routes: z.array(extensionRouteRecordSchema),
  navigation: z.array(extensionNavigationRecordSchema),
  settingsPanels: z.array(extensionSettingsPanelRecordSchema),
  diagnostics: z.array(extensionDiagnosticSchema),
});

export type ExtensionDiagnostic = z.infer<typeof extensionDiagnosticSchema>;
export type ExtensionRecord = z.infer<typeof extensionRecordSchema>;
export type ExtensionCommandRecord = z.infer<typeof extensionCommandRecordSchema>;
export type ExtensionMiddlewareRecord = z.infer<typeof extensionMiddlewareRecordSchema>;
export type ExtensionHookRecord = z.infer<typeof extensionHookRecordSchema>;
export type ExtensionScheduleRecord = z.infer<typeof extensionScheduleRecordSchema>;
export type ExtensionArtifactMount = z.infer<typeof extensionArtifactMountSchema>;
export type ExtensionThemeRecord = z.infer<typeof extensionThemeRecordSchema>;
export type ExtensionFileIconThemeRecord = z.infer<typeof extensionFileIconThemeRecordSchema>;
export type ExtensionMenuContribution = z.infer<typeof extensionMenuContributionSchema>;
export type ExtensionViewRecord = z.infer<typeof extensionViewRecordSchema>;
export type ExtensionRouteRecord = z.infer<typeof extensionRouteRecordSchema>;
export type ExtensionNavigationRecord = z.infer<typeof extensionNavigationRecordSchema>;
export type ExtensionSettingsPanelRecord = z.infer<typeof extensionSettingsPanelRecordSchema>;
export type ExtensionsCheckResponse = z.infer<typeof extensionsCheckResponseSchema>;
export type DashboardExtensionMetadata = z.infer<typeof dashboardExtensionMetadataSchema>;

export const listExtensionCommandsResponseSchema = z.object({
  commands: z.array(extensionCommandRecordSchema),
  diagnostics: z.array(extensionDiagnosticSchema),
});

export type ListExtensionCommandsResponse = z.infer<typeof listExtensionCommandsResponseSchema>;

export const listExtensionAppearanceResponseSchema = z.object({
  themes: z.array(extensionThemeRecordSchema),
  fileIconThemes: z.array(extensionFileIconThemeRecordSchema),
  diagnostics: z.array(extensionDiagnosticSchema),
});

export type ListExtensionAppearanceResponse = z.infer<typeof listExtensionAppearanceResponseSchema>;

export const enableInstalledExtensionRequestSchema = z.object({
  displayName: z.string(),
  extensionId: z.string(),
  manifest: jsonObjectSchema,
  namespace: z.string(),
  sourceHash: z.string().nullable().optional(),
  sourceKind: z.enum(["local_path", "git", "registry", "builtin"]),
  sourcePath: z.string(),
  sourceRef: z.string().nullable().optional(),
  version: z.string().nullable().optional(),
});

export const enableInstalledExtensionResponseSchema = z.object({
  enabled: z.literal(true),
  installName: z.string(),
  installedExtensionId: z.string(),
  instanceId: z.string(),
  namespace: z.string(),
  projectId: z.string(),
});

export type EnableInstalledExtensionRequest = z.infer<typeof enableInstalledExtensionRequestSchema>;
export type EnableInstalledExtensionResponse = z.infer<typeof enableInstalledExtensionResponseSchema>;

export const updateInstalledExtensionTemplateInputSchema = z.object({
  content: z.string().min(1),
});

export const updateInstalledExtensionTemplateResponseSchema = z.object({
  installName: z.string(),
  key: z.string(),
  content: z.string(),
});

export type UpdateInstalledExtensionTemplateInput = z.infer<typeof updateInstalledExtensionTemplateInputSchema>;
export type UpdateInstalledExtensionTemplateResponse = z.infer<typeof updateInstalledExtensionTemplateResponseSchema>;

export const extensionResourceRefSchema = z.object({
  type: z.string(),
  id: z.string(),
  projectId: z.string().optional(),
  label: z.string().optional(),
  extensionId: z.string().optional(),
  metadata: jsonObjectSchema.optional(),
});

export const extensionRepoContextSchema = z.object({
  projectId: z.string(),
  repoId: z.string(),
  path: z.string(),
  remote: z.string().nullable().optional(),
  role: z.enum(["default", "selected", "workspace"]).optional(),
});

export const extensionSlotInvocationSchema = z.object({
  id: z.string(),
  kind: extensionSlotKindSchema,
  context: jsonObjectSchema,
});

export const commandSourceSchema = z.enum([
  "cli",
  "dashboard",
  "api",
  "schedule",
  "event",
  "automation",
  "command-panel",
]);

export const commandExecuteRequestSchema = z.object({
  projectId: z.string().min(1),
  params: jsonObjectSchema.optional(),
  resource: extensionResourceRefSchema.optional(),
  slot: extensionSlotInvocationSchema.optional(),
  repo: extensionRepoContextSchema.optional(),
  source: commandSourceSchema.optional(),
  metadata: jsonObjectSchema.optional(),
});

export const commandExecuteBodySchema = z.object({
  params: jsonObjectSchema.optional(),
  resource: extensionResourceRefSchema.optional(),
  slot: extensionSlotInvocationSchema.optional(),
  repo: extensionRepoContextSchema.optional(),
  source: commandSourceSchema.optional(),
  metadata: jsonObjectSchema.optional(),
});

const serializedErrorSchema = z.object({
  name: z.string().optional(),
  message: z.string(),
  stack: z.string().optional(),
});

const commandNoticeSchema = z.object({
  type: z.enum(["info", "success", "warning", "error"]),
  title: z.string().optional(),
  message: z.string(),
  metadata: jsonObjectSchema.optional(),
});

const commandDiagnosticSchema = z.object({
  code: z.string(),
  message: z.string(),
  severity: z.enum(["info", "warning", "error"]),
  extensionId: z.string().optional(),
  commandId: z.string().optional(),
  metadata: jsonObjectSchema.optional(),
});

export const commandOutcomeSchema = z.object({
  ok: z.boolean(),
  status: z.enum(["success", "rejected", "error"]),
  value: z.unknown().optional(),
  code: z.string().optional(),
  reason: z.string().optional(),
  data: jsonObjectSchema.optional(),
  error: serializedErrorSchema.optional(),
  notices: z.array(commandNoticeSchema).optional(),
  diagnostics: z.array(commandDiagnosticSchema).optional(),
});

export const commandExecuteResponseSchema = z.object({
  commandId: z.string(),
  extensionId: z.string(),
  outcome: commandOutcomeSchema,
});

export const setupProjectExtensionResponseSchema = z.object({
  extensionId: z.string(),
  namespace: z.string(),
  installName: z.string(),
  installedSkills: z.array(
    z.object({
      id: z.string(),
      extensionId: z.string(),
      skillKey: z.string(),
      installedAgents: z.array(z.string()),
    }),
  ),
});

export type CommandExecuteRequest = z.infer<typeof commandExecuteRequestSchema>;
export type CommandExecuteBody = z.infer<typeof commandExecuteBodySchema>;
export type CommandExecuteResponse = z.infer<typeof commandExecuteResponseSchema>;
export type SetupProjectExtensionResponse = z.infer<typeof setupProjectExtensionResponseSchema>;
