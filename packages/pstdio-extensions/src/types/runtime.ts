import type {
  CommandMiddlewareHandler,
  CommandRunHandler,
  DataRendererContribution,
  ExtensionDefinition,
  ExtensionSettingProperty,
  ExtensionSourceKind,
  FileIconThemeContribution,
  HarnessProvider,
  HookDefinition,
  JsonObject,
  MenuContribution,
  ModeContribution,
  ParamObjectSchema,
  RouteContribution,
  SettingsPanelContribution,
  SkillContribution,
  TemplateContribution,
  TemplateTypeContribution,
  ThemeContribution,
  ThemeMode,
  TreeItemContribution,
  ViewContribution,
  WorkspaceTypeProvider,
} from "@pstdio/sdk/extensions";

export type ThemePreferenceTokens = Record<string, string>;

export interface RuntimeThemePreference {
  id: string;
  mode: ThemeMode;
  tokens: ThemePreferenceTokens;
}

export interface RuntimeMonacoTheme {
  base: "vs" | "vs-dark";
  inherit: true;
  rules: { token: string; foreground?: string; fontStyle?: string }[];
  colors: Record<string, string>;
}

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
  description?: string;
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
  title: string;
  description?: string;
  params: ParamObjectSchema;
  menus: MenuContribution[];
  cli?: RuntimeCliContribution;
  // biome-ignore lint/suspicious/noExplicitAny: handler invoked with extension-specific params
  run: CommandRunHandler<any, any>;
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
  handler: HookDefinition<any>["handler"];
}

export interface RuntimeArtifactMount {
  id: string;
  localId: string;
  extensionId: string;
  name: string;
  sourcePath: string;
  /** Normalized path relative to <repo>/.pstdio/<name>/. */
  relativePath: string;
  /** Full repo-relative path (.pstdio/<name>/<relativePath>). */
  fullPath: string;
  label: string;
  repoRole?: "default" | "selected" | "workspace";
}

export interface RuntimeScheduleRecord {
  id: string;
  localId: string;
  extensionId: string;
  name: string;
  sourcePath: string;
  title: string;
  cron: string;
  commandId: string;
  // biome-ignore lint/suspicious/noExplicitAny: heterogeneous schedule params
  params?: any;
  repoId?: string;
  disabled?: boolean;
}

export interface RuntimeViewRecord {
  id: string;
  localId: string;
  extensionId: string;
  name: string;
  sourcePath: string;
  contribution: ViewContribution;
}

export interface RuntimeRouteRecord {
  id: string;
  localId: string;
  extensionId: string;
  name: string;
  sourcePath: string;
  contribution: RouteContribution;
}

export interface RuntimeTreeItemRecord {
  id: string;
  localId: string;
  extensionId: string;
  name: string;
  sourcePath: string;
  contribution: TreeItemContribution;
}

export interface RuntimeModeRecord {
  id: string;
  localId: string;
  extensionId: string;
  name: string;
  sourcePath: string;
  contribution: ModeContribution;
}

export interface RuntimeSettingsPanelRecord {
  id: string;
  localId: string;
  extensionId: string;
  name: string;
  sourcePath: string;
  contribution: SettingsPanelContribution;
}

export interface RuntimeDataRendererRecord {
  id: string;
  localId: string;
  extensionId: string;
  name: string;
  sourcePath: string;
  contribution: DataRendererContribution;
}

export interface RuntimeExtensionSettingRecord {
  id: string;
  key: string;
  extensionId: string;
  name: string;
  sourcePath: string;
  contribution: ExtensionSettingProperty;
}

export interface RuntimeTemplateTypeRecord {
  id: string;
  localId: string;
  extensionId: string;
  name: string;
  sourcePath: string;
  contribution: TemplateTypeContribution;
}

export interface RuntimeTemplateRecord {
  id: string;
  localId: string;
  extensionId: string;
  name: string;
  sourcePath: string;
  contribution: TemplateContribution;
}

export interface RuntimeSkillRecord {
  id: string;
  localId: string;
  extensionId: string;
  name: string;
  sourcePath: string;
  contribution: SkillContribution;
}

export interface RuntimeThemeRecord {
  id: string;
  localId: string;
  extensionId: string;
  name: string;
  sourcePath: string;
  title: string;
  description?: string;
  format: ThemeContribution["format"];
  mode: ThemeMode;
  source: ThemeContribution["source"];
  preference: RuntimeThemePreference;
  monacoTheme: RuntimeMonacoTheme;
}

export interface RuntimeFileIconThemeRecord {
  id: string;
  localId: string;
  extensionId: string;
  name: string;
  sourcePath: string;
  title: string;
  description?: string;
  format: FileIconThemeContribution["format"];
  source: FileIconThemeContribution["source"];
  definitions: Record<string, unknown>;
  fileExtensions: Record<string, string>;
  fileNames: Record<string, string>;
}

export interface RuntimeHarnessRecord {
  id: string;
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
  middlewares: RuntimeMiddlewareRecord[];
  hooks: RuntimeHookRecord[];
  cli: RuntimeCliContribution[];
  schedules: RuntimeScheduleRecord[];
  artifactMounts: RuntimeArtifactMount[];
  modes: RuntimeModeRecord[];
  views: RuntimeViewRecord[];
  routes: RuntimeRouteRecord[];
  navigation: never[];
  treeItems: RuntimeTreeItemRecord[];
  settingsPanels: RuntimeSettingsPanelRecord[];
  dataRenderers: RuntimeDataRendererRecord[];
  settings: RuntimeExtensionSettingRecord[];
  templateTypes: RuntimeTemplateTypeRecord[];
  templates: RuntimeTemplateRecord[];
  skills: RuntimeSkillRecord[];
  themes: RuntimeThemeRecord[];
  fileIconThemes: RuntimeFileIconThemeRecord[];
  harnesses: RuntimeHarnessRecord[];
  workspaceTypes: RuntimeWorkspaceTypeRecord[];
  diagnostics: ExtensionDiagnostic[];
}
