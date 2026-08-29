import type {
  CommandMiddlewareHandler,
  CommandPaletteContribution,
  CommandRunHandler,
  ExtensionConnectionContribution,
  ExtensionDefinition,
  ExtensionSourceKind,
  HarnessProvider,
  HookDefinition,
  JsonObject,
  Localizable,
  MenuContribution,
  ParamObjectSchema,
  RendererCallback,
  WorkspaceTypeProvider,
} from "@pstdio/sdk/extensions";
import type {
  RuntimeActivityItemRecord,
  RuntimeCommandPaletteResourceRecord,
  RuntimeExtensionSettingRecord,
  RuntimeFileIconThemeRecord,
  RuntimeKeybindingRecord,
  RuntimeModeRecord,
  RuntimeNavigationItemRecord,
  RuntimePlacementRecord,
  RuntimeResourceHierarchyProviderRecord,
  RuntimeResourceKindRecord,
  RuntimeResourceViewRecord,
  RuntimeSettingsPanelRecord,
  RuntimeSettingsSectionRecord,
  RuntimeSkillRecord,
  RuntimeStatusBarItemRecord,
  RuntimeStatusRecord,
  RuntimeTemplateRecord,
  RuntimeTemplateTypeRecord,
  RuntimeThemeRecord,
  RuntimeViewMenuRecord,
  RuntimeViewRecord,
} from "./runtime-ui";

export * from "./runtime-ui";

export interface NormalizedExtension {
  /** Derived `${publisher}.${name}` from the package manifest. */
  id: string;
  /** Package name from package.json. */
  name: string;
  /** Optional display name from package.json. Falls back to `name`. */
  displayName: string;
  version: string;
  description?: string;
  /** Path to the extension's package directory. */
  packagePath: string;
  /** Path to the imported contributions entry file. */
  sourcePath: string;
  sourceKind: ExtensionSourceKind;
  definition: ExtensionDefinition;
}

export interface RuntimeCliContribution {
  extensionId: string;
  commandId: string;
  /** Package name of the owning extension; used as the CLI prefix. */
  name: string;
  /** Path segments under the extension name prefix. */
  path: string[];
  /** Joined path string for collision detection. */
  pathKey: string;
  description?: Localizable<string>;
  examples?: string[];
  hidden?: boolean;
  globalAliases?: string[][];
}

export interface RuntimeCommandRecord {
  id: string;
  localId: string;
  extensionId: string;
  name: string;
  sourcePath: string;
  title: Localizable<string>;
  description?: Localizable<string>;
  params: ParamObjectSchema;
  menus: MenuContribution[];
  palette: CommandPaletteContribution[];
  cli?: RuntimeCliContribution;
  automation: boolean;
  mutating: boolean;
  // biome-ignore lint/suspicious/noExplicitAny: handler invoked with extension-specific params
  run: CommandRunHandler<any, any>;
}

export interface RuntimeConnectionRecord {
  id: string;
  localId: string;
  extensionId: string;
  name: string;
  sourcePath: string;
  contribution: ExtensionConnectionContribution;
}

export interface RuntimePrivateHandlerRecord {
  id: string;
  localId: string;
  extensionId: string;
  name: string;
  sourcePath: string;
  rendererId: string;
  rendererKind: "commandPaletteResource" | "controls" | "dataTable" | "file" | "kanban" | "status" | "tree";
  operation: string;
  // biome-ignore lint/suspicious/noExplicitAny: handler invoked with renderer-specific input
  handler: RendererCallback<any, any>;
}

export interface RuntimeMiddlewareRecord {
  id: string;
  localId: string;
  extensionId: string;
  name: string;
  sourcePath: string;
  commandId: string;
  // biome-ignore lint/suspicious/noExplicitAny: handler invoked with extension-specific params
  handler: CommandMiddlewareHandler<any>;
}

export interface RuntimeHookRecord {
  id: string;
  localId: string;
  extensionId: string;
  name: string;
  sourcePath: string;
  eventId: string;
  // biome-ignore lint/suspicious/noExplicitAny: handler invoked with event-specific payload
  handler: HookDefinition<any>["run"];
}

export interface RuntimeArtifactMount {
  id: string;
  localId: string;
  extensionId: string;
  name: string;
  sourcePath: string;
  /** Normalized path relative to <repo>/.pstdio/extension-storage/<name>/. */
  relativePath: string;
  /** Full repo-relative path (.pstdio/extension-storage/<name>/<relativePath>). */
  fullPath: string;
  label: Localizable<string>;
  repoRole?: "default" | "selected" | "workspace";
}

export interface RuntimeScheduleRecord {
  id: string;
  localId: string;
  extensionId: string;
  name: string;
  sourcePath: string;
  title: Localizable<string>;
  cron: string;
  commandId: string;
  // biome-ignore lint/suspicious/noExplicitAny: heterogeneous schedule params
  params?: any;
  repoId?: string;
  disabled?: boolean;
}

export interface RuntimeHarnessRecord {
  /** Composed `${extensionId}.${localId}`. */
  id: string;
  /** Bare provider id (e.g. "claude-code"). */
  localId: string;
  extensionId: string;
  name: string;
  sourcePath: string;
  provider: HarnessProvider;
}

export interface RuntimeWorkspaceTypeRecord {
  id: string;
  extensionId: string;
  name: string;
  sourcePath: string;
  provider: WorkspaceTypeProvider;
}

export interface RuntimeTranslationRecord {
  extensionId: string;
  defaultLocale: string;
  bundles: Record<string, Record<string, string>>;
}

export type ExtensionDiagnosticSeverity = "info" | "warning" | "error";

export interface ExtensionDiagnostic {
  code: string;
  severity: ExtensionDiagnosticSeverity;
  message: string;
  extensionId?: string;
  commandId?: string;
  sourcePath?: string;
  metadata?: JsonObject;
}

export interface ExtensionRuntime {
  extensions: NormalizedExtension[];
  commands: RuntimeCommandRecord[];
  connections: RuntimeConnectionRecord[];
  privateHandlers: RuntimePrivateHandlerRecord[];
  middlewares: RuntimeMiddlewareRecord[];
  hooks: RuntimeHookRecord[];
  cli: RuntimeCliContribution[];
  schedules: RuntimeScheduleRecord[];
  artifactMounts: RuntimeArtifactMount[];
  modes: RuntimeModeRecord[];
  views: RuntimeViewRecord[];
  viewMenus: RuntimeViewMenuRecord[];
  placements: RuntimePlacementRecord[];
  navigationItems: RuntimeNavigationItemRecord[];
  statusBarItems: RuntimeStatusBarItemRecord[];
  statuses: RuntimeStatusRecord[];
  resourceKinds: RuntimeResourceKindRecord[];
  resourceViews: RuntimeResourceViewRecord[];
  resourceHierarchyProviders: RuntimeResourceHierarchyProviderRecord[];
  activityItems: RuntimeActivityItemRecord[];
  settingsSections: RuntimeSettingsSectionRecord[];
  settingsPanels: RuntimeSettingsPanelRecord[];
  commandPaletteResources: RuntimeCommandPaletteResourceRecord[];
  keybindings: RuntimeKeybindingRecord[];
  settings: RuntimeExtensionSettingRecord[];
  templateTypes: RuntimeTemplateTypeRecord[];
  templates: RuntimeTemplateRecord[];
  skills: RuntimeSkillRecord[];
  themes: RuntimeThemeRecord[];
  fileIconThemes: RuntimeFileIconThemeRecord[];
  translations: RuntimeTranslationRecord[];
  harnesses: RuntimeHarnessRecord[];
  workspaceTypes: RuntimeWorkspaceTypeRecord[];
  diagnostics: ExtensionDiagnostic[];
}
