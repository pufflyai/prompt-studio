import type {
  CommandMiddlewareHandler,
  CommandPaletteContribution,
  CommandPaletteResourceContribution,
  CommandRunHandler,
  ControlsRendererContribution,
  DataTableRendererContribution,
  ExtensionDefinition,
  ExtensionSettingProperty,
  ExtensionSourceKind,
  FileIconThemeContribution,
  FileRendererContribution,
  HarnessProvider,
  HookDefinition,
  JsonObject,
  KanbanRendererContribution,
  KeybindingContribution,
  Localizable,
  MenuContribution,
  ModeContribution,
  PanelContribution,
  ParamObjectSchema,
  RouteContribution,
  SettingsPanelContribution,
  SkillContribution,
  TemplateContribution,
  TemplateTypeContribution,
  ThemeContribution,
  ThemeMode,
  TreeItemContribution,
  TreeRendererContribution,
  WhenExpression,
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

export interface RuntimePanelRecord {
  id: string;
  localId: string;
  extensionId: string;
  name: string;
  sourcePath: string;
  contribution: PanelContribution;
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

export interface RuntimeKanbanRendererRecord {
  id: string;
  localId: string;
  extensionId: string;
  name: string;
  sourcePath: string;
  contribution: KanbanRendererContribution;
}

export interface RuntimeDataTableRendererRecord {
  id: string;
  localId: string;
  extensionId: string;
  name: string;
  sourcePath: string;
  contribution: DataTableRendererContribution;
}

export interface RuntimeCommandPaletteResourceRecord {
  id: string;
  localId: string;
  extensionId: string;
  name: string;
  sourcePath: string;
  contribution: CommandPaletteResourceContribution;
}

export interface ParsedKeybindingChord {
  key: string;
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
  meta: boolean;
  modifiers: string[];
}

export interface RuntimeKeybindingRecord {
  id: string;
  localId: string;
  extensionId: string;
  name: string;
  sourcePath: string;
  commandId: string;
  contribution: KeybindingContribution;
  /**
   * Platform-independent canonical chord string produced by TanStack's
   * `normalizeHotkey(input, "mac")`. Two contributions with the same
   * canonical chord and `when` predicate collide.
   */
  canonicalChord: string;
  parsed: ParsedKeybindingChord;
  when?: WhenExpression;
}

export interface RuntimeTreeRendererRecord {
  id: string;
  localId: string;
  extensionId: string;
  name: string;
  sourcePath: string;
  contribution: TreeRendererContribution;
}

export interface RuntimeFileRendererRecord {
  id: string;
  localId: string;
  extensionId: string;
  name: string;
  sourcePath: string;
  contribution: FileRendererContribution;
}

export interface RuntimeControlsRendererRecord {
  id: string;
  localId: string;
  extensionId: string;
  name: string;
  sourcePath: string;
  contribution: ControlsRendererContribution;
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
  title: Localizable<string>;
  description?: Localizable<string>;
  format: ThemeContribution["format"];
  mode: ThemeMode;
  source: ThemeContribution["source"];
  preference: RuntimeThemePreference;
  monacoTheme: RuntimeMonacoTheme;
}

export interface RuntimeFileIconThemeFont {
  fontFamily: string;
  src: { url: string; format?: string }[];
  weight?: string;
  style?: string;
}

export interface RuntimeFileIconThemeRecord {
  id: string;
  localId: string;
  extensionId: string;
  name: string;
  sourcePath: string;
  title: Localizable<string>;
  description?: Localizable<string>;
  format: FileIconThemeContribution["format"];
  source: FileIconThemeContribution["source"];
  definitions: Record<string, unknown>;
  fileExtensions: Record<string, string>;
  fileNames: Record<string, string>;
  defaults: { file?: string; folder?: string };
  fonts: RuntimeFileIconThemeFont[];
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
  middlewares: RuntimeMiddlewareRecord[];
  hooks: RuntimeHookRecord[];
  cli: RuntimeCliContribution[];
  schedules: RuntimeScheduleRecord[];
  artifactMounts: RuntimeArtifactMount[];
  modes: RuntimeModeRecord[];
  panels: RuntimePanelRecord[];
  routes: RuntimeRouteRecord[];
  navigation: never[];
  treeItems: RuntimeTreeItemRecord[];
  settingsPanels: RuntimeSettingsPanelRecord[];
  kanbanRenderers: RuntimeKanbanRendererRecord[];
  dataTableRenderers: RuntimeDataTableRendererRecord[];
  commandPaletteResources: RuntimeCommandPaletteResourceRecord[];
  treeRenderers: RuntimeTreeRendererRecord[];
  fileRenderers: RuntimeFileRendererRecord[];
  controlsRenderers: RuntimeControlsRendererRecord[];
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
