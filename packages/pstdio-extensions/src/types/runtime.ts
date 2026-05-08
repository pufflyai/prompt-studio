import type {
  CommandMiddlewareHandler,
  CommandRunHandler,
  ExtensionDefinition,
  ExtensionSourceKind,
  FileIconThemeContribution,
  HarnessProvider,
  HookDefinition,
  JsonObject,
  MenuContribution,
  NavigationContribution,
  ParamObjectSchema,
  RouteContribution,
  SettingsPanelContribution,
  SkillContribution,
  TemplateContribution,
  TemplateTypeContribution,
  ThemeContribution,
  ThemeMode,
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
  id: string;
  namespace: string;
  displayName: string;
  version?: string;
  description?: string;
  sourcePath: string;
  sourceKind: ExtensionSourceKind;
  definition: ExtensionDefinition;
}

export interface RuntimeCliContribution {
  extensionId: string;
  commandId: string;
  namespace: string;
  /** Path segments under the namespace. */
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
  namespace: string;
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
  namespace: string;
  sourcePath: string;
  commandId: string;
  // biome-ignore lint/suspicious/noExplicitAny: handler invoked with extension-specific params
  handler: CommandMiddlewareHandler<any>;
}

export interface RuntimeHookRecord {
  id: string;
  localId: string;
  extensionId: string;
  namespace: string;
  sourcePath: string;
  eventId: string;
  // biome-ignore lint/suspicious/noExplicitAny: handler invoked with event-specific payload
  handler: HookDefinition<any>["handler"];
}

export interface RuntimeArtifactMount {
  id: string;
  localId: string;
  extensionId: string;
  namespace: string;
  sourcePath: string;
  /** Normalized path relative to <repo>/.pstdio/<namespace>/. */
  relativePath: string;
  /** Full repo-relative path (.pstdio/<namespace>/<relativePath>). */
  fullPath: string;
  label: string;
  repoRole?: "default" | "selected" | "workspace";
}

export interface RuntimeScheduleRecord {
  id: string;
  localId: string;
  extensionId: string;
  namespace: string;
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
  namespace: string;
  sourcePath: string;
  contribution: ViewContribution;
}

export interface RuntimeRouteRecord {
  id: string;
  localId: string;
  extensionId: string;
  namespace: string;
  sourcePath: string;
  contribution: RouteContribution;
}

export interface RuntimeNavigationRecord {
  id: string;
  localId: string;
  extensionId: string;
  namespace: string;
  sourcePath: string;
  contribution: NavigationContribution;
}

export interface RuntimeSettingsPanelRecord {
  id: string;
  localId: string;
  extensionId: string;
  namespace: string;
  sourcePath: string;
  contribution: SettingsPanelContribution;
}

export interface RuntimeTemplateTypeRecord {
  id: string;
  localId: string;
  extensionId: string;
  namespace: string;
  sourcePath: string;
  contribution: TemplateTypeContribution;
}

export interface RuntimeTemplateRecord {
  id: string;
  localId: string;
  extensionId: string;
  namespace: string;
  sourcePath: string;
  contribution: TemplateContribution;
}

export interface RuntimeSkillRecord {
  id: string;
  localId: string;
  extensionId: string;
  namespace: string;
  sourcePath: string;
  contribution: SkillContribution;
}

export interface RuntimeThemeRecord {
  id: string;
  localId: string;
  extensionId: string;
  namespace: string;
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
  namespace: string;
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
  namespace: string;
  sourcePath: string;
  provider: HarnessProvider;
}

export interface RuntimeWorkspaceTypeRecord {
  id: string;
  extensionId: string;
  namespace: string;
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
  views: RuntimeViewRecord[];
  routes: RuntimeRouteRecord[];
  navigation: RuntimeNavigationRecord[];
  settingsPanels: RuntimeSettingsPanelRecord[];
  templateTypes: RuntimeTemplateTypeRecord[];
  templates: RuntimeTemplateRecord[];
  skills: RuntimeSkillRecord[];
  themes: RuntimeThemeRecord[];
  fileIconThemes: RuntimeFileIconThemeRecord[];
  harnesses: RuntimeHarnessRecord[];
  workspaceTypes: RuntimeWorkspaceTypeRecord[];
  diagnostics: ExtensionDiagnostic[];
}
