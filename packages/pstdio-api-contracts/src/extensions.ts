import { z } from "zod";

const jsonObjectSchema = z.record(z.string(), z.unknown());
const extensionSettingScopeSchema = z.enum(["global", "project"]);
const extensionSettingValueTypeSchema = z.enum(["boolean", "number", "string", "array", "object"]);
const extensionSettingSourceSchema = z.enum(["stored", "default"]);

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
  name: z.string(),
  displayName: z.string(),
  version: z.string().optional(),
  description: z.string().optional(),
  sourcePath: z.string(),
});

export const extensionCommandRecordSchema = z.object({
  id: z.string(),
  extensionId: z.string(),
  title: z.string(),
  description: z.string().optional(),
  cliPath: z.string().optional(),
  cliAliases: z.array(z.string()).optional(),
  examples: z.array(z.string()).optional(),
  excludeFromPalette: z.boolean().optional(),
  params: z.record(z.string(), z.object({ type: z.string() }).catchall(z.unknown())).optional(),
});

const extensionParamObjectSchema = z.record(z.string(), z.object({ type: z.string() }).catchall(z.unknown()));

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
  title: z.string(),
  description: z.string().optional(),
  format: z.literal("vscode-file-icon-theme"),
  source: packageAssetDescriptorSchema,
  definitions: jsonObjectSchema,
  fileExtensions: z.record(z.string(), z.string()),
  fileNames: z.record(z.string(), z.string()),
});

const extensionPlacementSchema = z.enum(["first", "default", "last"]);
const extensionSlotKindSchema = z.enum(["menu", "view", "settings", "renderer", "dataRenderer"]);
const workbenchMenuTargetSchema = z.enum([
  "workbench.nav.actions",
  "workbench.nav.overflow",
  "workbench.commandPalette",
]);
const workbenchTreeTargetSchema = z.enum([
  "workbench.left.tree",
  "workbench.main.left.tree",
  "workbench.main.right.tree",
]);
const workbenchViewTargetSchema = z.enum([
  "workbench.main",
  "workbench.main.left",
  "workbench.main.right",
  "workbench.secondary",
]);
const workbenchSettingsTargetSchema = z.enum(["workbench.settings"]);
const workbenchModeLayoutTargetSchema = z.enum([
  "workbench.left",
  "workbench.main.left",
  "workbench.main",
  "workbench.main.right",
  "workbench.secondary",
]);
const workbenchAttachmentTargetSchema = z.union([
  workbenchMenuTargetSchema,
  workbenchTreeTargetSchema,
  workbenchViewTargetSchema,
  workbenchSettingsTargetSchema,
]);
const workbenchSettingsScopeSchema = z.enum(["project", "global"]);
export const commandSourceSchema = z.enum([
  "cli",
  "dashboard",
  "api",
  "schedule",
  "event",
  "automation",
  "command-panel",
]);
const extensionWhenExpressionSchema = z.object({
  mode: z.union([z.string(), z.array(z.string())]).optional(),
  source: z.array(commandSourceSchema).optional(),
  resourceType: z.array(z.string()).optional(),
  metadata: jsonObjectSchema.optional(),
});

const extensionWebviewContributionSchema = z.object({
  entry: packageAssetDescriptorSchema,
  title: z.string().optional(),
  /** Host capabilities the webview is allowed to invoke through the bridge. */
  capabilities: z.array(z.string()).optional(),
});

const workbenchExtensionWebviewSchema = extensionWebviewContributionSchema.extend({
  /** API-served URL of the bridge runtime HTML the dashboard mounts in the iframe. */
  runtimeUrl: z.string(),
  /** API-served URL of the bundled extension module the bridge runtime dynamically imports. */
  moduleUrl: z.string(),
  /** API-served URLs of CSS files the bridge runtime should inject before mounting the module. */
  styles: z.array(z.string()).optional(),
});

export const extensionMenuContributionSchema = z.object({
  id: z.string(),
  extensionId: z.string(),
  commandId: z.string(),
  slotId: z.string(),
  target: workbenchMenuTargetSchema.optional(),
  label: z.string(),
  group: z.string().optional(),
  placement: extensionPlacementSchema.optional(),
  icon: z.string().optional(),
  presentation: z.enum(["menu-item", "button", "icon-button"]).optional(),
  params: jsonObjectSchema.optional(),
  when: extensionWhenExpressionSchema.optional(),
});

export const extensionViewRecordSchema = z.object({
  id: z.string(),
  extensionId: z.string(),
  slotId: z.string(),
  target: workbenchViewTargetSchema.optional(),
  title: z.string(),
  group: z.string().optional(),
  placement: extensionPlacementSchema.optional(),
  /** When set, the host opens this view's webview for resources of this kind. */
  resourceKind: z.string().optional(),
  /** `modal` mounts the view as an overlay dialog (e.g. data-renderer create flows). */
  surface: z.enum(["panel", "modal"]).optional(),
  webview: extensionWebviewContributionSchema,
});

export const extensionRouteRecordSchema = z.object({
  id: z.string(),
  extensionId: z.string(),
  path: z.string(),
  label: z.string(),
  webview: extensionWebviewContributionSchema,
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
  when: extensionWhenExpressionSchema.optional(),
});

const extensionTreeItemActionSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("command"),
    commandId: z.string(),
    args: jsonObjectSchema.optional(),
  }),
  z.object({ kind: z.literal("dataRenderer"), dataRendererId: z.string() }),
  z.object({ kind: z.literal("route"), route: z.string() }),
  z.object({ kind: z.literal("href"), href: z.string() }),
]);

export const extensionTreeItemContributionSchema = z.object({
  id: z.string(),
  extensionId: z.string(),
  target: workbenchTreeTargetSchema,
  label: z.string(),
  group: z.string().optional(),
  placement: extensionPlacementSchema.optional(),
  icon: z.string().optional(),
  action: extensionTreeItemActionSchema,
  when: extensionWhenExpressionSchema.optional(),
});

const modeTargetContributionRecordSchema = z
  .object({
    target: workbenchModeLayoutTargetSchema,
    view: z.string().optional(),
    resource: z.string().optional(),
    widget: z.string().optional(),
    title: z.string().optional(),
    pinned: z.boolean().optional(),
  })
  .refine((value) => value.view || value.resource, {
    message: "Mode layout entries must declare a view or resource",
  });

export const modeLayoutContributionRecordSchema = z.object({
  reset: z.union([z.boolean(), z.array(workbenchModeLayoutTargetSchema)]).optional(),
  open: z.array(modeTargetContributionRecordSchema).optional(),
});

export const extensionModeRecordSchema = z.object({
  id: z.string(),
  extensionId: z.string(),
  modeId: z.string(),
  label: z.string(),
  icon: z.string().optional(),
  layout: modeLayoutContributionRecordSchema.optional(),
});

export const extensionSettingsPanelRecordSchema = z.object({
  id: z.string(),
  extensionId: z.string(),
  extensionInstanceId: z.string().optional(),
  installedExtensionId: z.string().optional(),
  installName: z.string().optional(),
  slotId: z.string(),
  target: workbenchSettingsTargetSchema.optional(),
  scope: workbenchSettingsScopeSchema.optional(),
  title: z.string(),
  webview: extensionWebviewContributionSchema,
});

export const extensionSettingDefinitionRecordSchema = z.object({
  key: z.string(),
  extensionId: z.string(),
  type: extensionSettingValueTypeSchema,
  scope: extensionSettingScopeSchema,
  default: z.unknown().optional(),
  enum: z.array(z.unknown()).optional(),
  title: z.string().optional(),
  description: z.string().optional(),
});

export const extensionSettingValueRecordSchema = extensionSettingDefinitionRecordSchema.extend({
  value: z.unknown().optional(),
  source: extensionSettingSourceSchema,
});

export const listExtensionSettingsResponseSchema = z.object({
  settings: z.array(extensionSettingValueRecordSchema),
});

export const updateExtensionSettingRequestSchema = z.object({
  value: z.unknown(),
});

const dataRendererEnumOptionSchema = z.object({
  value: z.string(),
  label: z.string(),
  color: z.string().optional(),
  icon: z.string().nullable().optional(),
});

const dataRendererAttributeTypeSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("enum"), options: z.array(dataRendererEnumOptionSchema) }),
  z.object({ kind: z.literal("enum-multi"), options: z.array(dataRendererEnumOptionSchema) }),
  z.object({ kind: z.literal("string") }),
  z.object({ kind: z.literal("date") }),
  z.object({ kind: z.literal("number") }),
  z.object({ kind: z.literal("user") }),
]);

const dataRendererAttributeSchema = z.object({
  id: z.string(),
  label: z.string(),
  type: dataRendererAttributeTypeSchema,
  filterable: z.boolean().optional(),
  groupable: z.boolean().optional(),
  sortable: z.boolean().optional(),
  displayable: z.boolean().optional(),
  editable: z.boolean().optional(),
});

const dataRendererSettingsSchema = z.object({
  viewMode: z.enum(["board", "list"]),
  columnGrouping: z.string(),
  rowGrouping: z.string(),
  ordering: z.object({
    attributeId: z.string(),
    direction: z.enum(["asc", "desc"]),
  }),
  displayProperties: z.array(z.string()),
});

const extensionDataRendererCreateRowSchema = z.object({
  commandId: z.string(),
  title: z.string().optional(),
  submitLabel: z.string().optional(),
  columnParam: z.string().optional(),
  params: extensionParamObjectSchema.optional(),
});

const extensionDataRendererRowActionSchema = z.object({
  id: z.string(),
  label: z.string(),
  icon: z.string().optional(),
  commandId: z.string(),
  destructive: z.boolean().optional(),
});

export const extensionDataRendererRecordSchema = z.object({
  id: z.string(),
  extensionId: z.string(),
  title: z.string(),
  resourceKind: z.string().optional(),
  attributes: z.array(dataRendererAttributeSchema).optional(),
  queryCommandId: z.string(),
  updateAttributeCommandId: z.string().optional(),
  reorderCommandId: z.string().optional(),
  columnActionCommandId: z.string().optional(),
  createRow: extensionDataRendererCreateRowSchema.optional(),
  rowActions: z.array(extensionDataRendererRowActionSchema).optional(),
  defaultSettings: dataRendererSettingsSchema.partial().optional(),
  defaultFilters: z.record(z.string(), z.array(z.string())).optional(),
  emptyTitle: z.string().optional(),
  emptyDescription: z.string().optional(),
  hideToolbar: z.boolean().optional(),
  savedViews: z
    .object({
      resourceKind: z.string(),
      scope: z.enum(["project", "user"]).optional(),
    })
    .optional(),
});

export const workbenchExtensionViewRecordSchema = extensionViewRecordSchema.extend({
  extensionInstanceId: z.string().optional(),
  installedExtensionId: z.string().optional(),
  installName: z.string().optional(),
  webview: workbenchExtensionWebviewSchema,
});

export const workbenchExtensionRouteRecordSchema = extensionRouteRecordSchema.extend({
  extensionInstanceId: z.string().optional(),
  installedExtensionId: z.string().optional(),
  installName: z.string().optional(),
  webview: workbenchExtensionWebviewSchema,
});

export const workbenchExtensionSettingsPanelRecordSchema = extensionSettingsPanelRecordSchema.extend({
  webview: workbenchExtensionWebviewSchema,
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
  modes: z.array(extensionModeRecordSchema),
  views: z.array(extensionViewRecordSchema),
  routes: z.array(extensionRouteRecordSchema),
  navigation: z.array(extensionNavigationRecordSchema),
  treeItems: z.array(extensionTreeItemContributionSchema),
  settingsPanels: z.array(extensionSettingsPanelRecordSchema),
  dataRenderers: z.array(extensionDataRendererRecordSchema),
  settingsDefinitions: z.array(extensionSettingDefinitionRecordSchema).optional(),
  templates: z.array(extensionViewLikeSchema),
  skills: z.array(extensionViewLikeSchema),
  diagnostics: z.array(extensionDiagnosticSchema),
});

export const workbenchExtensionMetadataSchema = z.object({
  extensions: z.array(extensionRecordSchema),
  commands: z.array(extensionCommandRecordSchema),
  menuContributions: z.array(extensionMenuContributionSchema),
  modes: z.array(extensionModeRecordSchema),
  views: z.array(workbenchExtensionViewRecordSchema),
  routes: z.array(workbenchExtensionRouteRecordSchema),
  navigation: z.array(extensionNavigationRecordSchema),
  treeItems: z.array(extensionTreeItemContributionSchema).optional(),
  settingsPanels: z.array(workbenchExtensionSettingsPanelRecordSchema),
  dataRenderers: z.array(extensionDataRendererRecordSchema).optional(),
  settingsDefinitions: z.array(extensionSettingDefinitionRecordSchema).optional(),
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
export type ExtensionTreeItemContribution = z.infer<typeof extensionTreeItemContributionSchema>;
export type ModeLayoutContributionRecord = z.infer<typeof modeLayoutContributionRecordSchema>;
export type ExtensionModeRecord = z.infer<typeof extensionModeRecordSchema>;
export type ExtensionSettingsPanelRecord = z.infer<typeof extensionSettingsPanelRecordSchema>;
export type ExtensionDataRendererRecord = z.infer<typeof extensionDataRendererRecordSchema>;
export type ExtensionSettingDefinitionRecord = z.infer<typeof extensionSettingDefinitionRecordSchema>;
export type ExtensionSettingValueRecord = z.infer<typeof extensionSettingValueRecordSchema>;
export type ListExtensionSettingsResponse = z.infer<typeof listExtensionSettingsResponseSchema>;
export type UpdateExtensionSettingRequest = z.infer<typeof updateExtensionSettingRequestSchema>;
export type WorkbenchExtensionViewRecord = z.infer<typeof workbenchExtensionViewRecordSchema>;
export type WorkbenchExtensionRouteRecord = z.infer<typeof workbenchExtensionRouteRecordSchema>;
export type WorkbenchExtensionSettingsPanelRecord = z.infer<typeof workbenchExtensionSettingsPanelRecordSchema>;
export type WorkbenchExtensionDataRendererRecord = z.infer<typeof extensionDataRendererRecordSchema>;
export type ExtensionsCheckResponse = z.infer<typeof extensionsCheckResponseSchema>;
export type WorkbenchExtensionMetadata = z.infer<typeof workbenchExtensionMetadataSchema>;

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
  name: z.string(),
  sourceHash: z.string().nullable().optional(),
  sourceKind: z.enum(["local_path", "git", "registry"]),
  sourcePath: z.string(),
  sourceRef: z.string().nullable().optional(),
  version: z.string().nullable().optional(),
});

export const enableInstalledExtensionResponseSchema = z.object({
  enabled: z.literal(true),
  installName: z.string(),
  installedExtensionId: z.string(),
  instanceId: z.string(),
  name: z.string(),
  projectId: z.string(),
});

export type EnableInstalledExtensionRequest = z.infer<typeof enableInstalledExtensionRequestSchema>;
export type EnableInstalledExtensionResponse = z.infer<typeof enableInstalledExtensionResponseSchema>;

export const projectExtensionInstanceSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  extensionId: z.string(),
  installedExtensionId: z.string(),
  installName: z.string(),
  name: z.string(),
  displayName: z.string(),
  version: z.string().nullable().optional(),
  description: z.string().optional(),
  sourcePath: z.string(),
  enabled: z.boolean(),
  config: z.record(z.string(), z.unknown()),
});

export const listProjectExtensionsResponseSchema = z.object({
  extensions: z.array(projectExtensionInstanceSchema),
});

export const setProjectExtensionEnabledRequestSchema = z.object({
  enabled: z.boolean(),
});

export type ProjectExtensionInstance = z.infer<typeof projectExtensionInstanceSchema>;
export type ListProjectExtensionsResponse = z.infer<typeof listProjectExtensionsResponseSchema>;
export type SetProjectExtensionEnabledRequest = z.infer<typeof setProjectExtensionEnabledRequestSchema>;

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

export const extensionAttachmentInvocationSchema = z.object({
  target: workbenchAttachmentTargetSchema,
  mode: z.string().optional(),
  projectId: z.string().optional(),
  resource: extensionResourceRefSchema.optional(),
});

export const commandExecuteRequestSchema = z.object({
  projectId: z.string().min(1),
  params: jsonObjectSchema.optional(),
  resource: extensionResourceRefSchema.optional(),
  attachment: extensionAttachmentInvocationSchema.optional(),
  slot: extensionSlotInvocationSchema.optional(),
  repo: extensionRepoContextSchema.optional(),
  source: commandSourceSchema.optional(),
  metadata: jsonObjectSchema.optional(),
});

export const commandExecuteBodySchema = z.object({
  params: jsonObjectSchema.optional(),
  resource: extensionResourceRefSchema.optional(),
  attachment: extensionAttachmentInvocationSchema.optional(),
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
  name: z.string(),
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
