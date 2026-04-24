export type ExtensionSourceKind = "local" | "package";
export type ExtensionDiagnosticSeverity = "error" | "warning";

export type ExtensionDiagnosticCode =
  | "invalid_export"
  | "invalid_extension_id"
  | "duplicate_extension_id"
  | "invalid_command"
  | "duplicate_command_id"
  | "duplicate_cli_path"
  | "unsafe_artifact_mount_path"
  | "duplicate_artifact_mount"
  | "invalid_package_asset"
  | "invalid_template"
  | "invalid_harness";

export type ExtensionDiagnosticRelated = {
  extensionId?: string;
  commandId?: string;
  path?: string;
  sourcePath?: string;
  label?: string;
};

export type ExtensionDiagnostic = {
  code: ExtensionDiagnosticCode;
  severity: ExtensionDiagnosticSeverity;
  message: string;
  extensionId?: string;
  sourcePath?: string;
  related?: ExtensionDiagnosticRelated[];
};

export type ResourceRef = {
  type: string;
  id: string;
  projectId?: string;
  label?: string;
  extensionId?: string;
  role?: "primary" | "context" | "source" | "result";
  metadata?: Record<string, unknown>;
};

export type ResourceDefinition = {
  type: string;
  label: string;
  description?: string;
};

export type SlotDefinition = {
  id: string;
  label: string;
  description?: string;
};

export type EventDefinition<TPayload = Record<string, unknown>> = {
  id: string;
  label?: string;
  description?: string;
  payload?: TPayload;
};

export type PackageAssetDescriptor = {
  kind: "package-asset";
  sourcePath: string;
  baseUrl: string;
};

export type TextParam = {
  type: "text";
  label?: string;
  description?: string;
  required?: boolean;
  defaultValue?: string;
};

export type LongTextParam = Omit<TextParam, "type"> & {
  type: "longtext";
};

export type BooleanParam = {
  type: "boolean";
  label?: string;
  description?: string;
  required?: boolean;
  defaultValue?: boolean;
};

export type SelectParam = {
  type: "select";
  label?: string;
  description?: string;
  required?: boolean;
  options: { value: string; label: string }[];
  defaultValue?: string;
};

export type TemplateParam = {
  type: "template";
  label?: string;
  description?: string;
  required?: boolean;
  templateType?: string;
};

export type HarnessParam = {
  type: "harness";
  label?: string;
  description?: string;
  required?: boolean;
};

export type ResourceParam = {
  type: "resource";
  label?: string;
  description?: string;
  required?: boolean;
  resourceType?: string;
};

export type ParamDefinition =
  | TextParam
  | LongTextParam
  | BooleanParam
  | SelectParam
  | TemplateParam
  | HarnessParam
  | ResourceParam;

export type ParamSchema = Record<string, ParamDefinition>;
export type ParamValue = string | boolean | number | ResourceRef | null | undefined;

export type CliOption = {
  type: "string" | "boolean" | "number";
  description?: string;
  required?: boolean;
  defaultValue?: string | boolean | number;
};

export type CliContribution = {
  path: string;
  description?: string;
  options?: Record<string, CliOption>;
  examples?: string[];
  hidden?: boolean;
};

export type MenuContribution = {
  slot: string;
  order?: number;
  label?: string;
  group?: string;
};

export type ExtensionSessionsApi = {
  create(input: {
    title: string;
    prompt?: string;
    anchors?: ResourceRef[];
    metadata?: Record<string, unknown>;
  }): Promise<unknown>;
};

export type ExtensionCommandsApi = {
  run(commandId: string, input?: Record<string, unknown>): Promise<unknown>;
};

export type CommandRunContext = {
  projectId: string;
  target: ResourceRef;
  params: Record<string, ParamValue>;
  sessions: ExtensionSessionsApi;
  commands: ExtensionCommandsApi;
};

export type CommandHandler = (ctx: CommandRunContext) => void | Promise<void> | unknown | Promise<unknown>;

export type CommandDefinition = {
  title: string;
  target?: string;
  params?: ParamSchema;
  menus?: MenuContribution[];
  cli?: CliContribution;
  run: CommandHandler;
};

export type ArtifactMountDefinition = {
  path: string;
  label: string;
  repoRole?: string;
};

export type TemplateTypeDefinition = {
  label: string;
  description?: string;
};

export type TemplateDefinition = {
  title: string;
  type: string;
  source: PackageAssetDescriptor;
  description?: string;
};

export type SkillDefinition = {
  title: string;
  source: PackageAssetDescriptor;
  description?: string;
};

export type ViewContribution = {
  type: string;
  label: string;
  target?: string;
  slot?: string;
  order?: number;
  component?: unknown;
};

export type RouteContribution = {
  path: string;
  label?: string;
  component?: unknown;
};

export type SettingsPanelContribution = {
  label: string;
  component?: unknown;
  order?: number;
};

export type ActivityRendererContribution = {
  resourceType: string;
  component?: unknown;
};

export type SessionAnchorRendererContribution = {
  resourceType: string;
  component?: unknown;
};

export type EventHandlerDefinition<TPayload = Record<string, unknown>> = {
  event: EventDefinition<TPayload> | string;
  handler: (ctx: ExtensionSetupContext, event: TPayload) => void | Promise<void>;
};

export type ExtensionStorageCollection = {
  list(): Promise<{ id: string; value: unknown }[]>;
  get(id: string): Promise<unknown | null>;
  put(id: string, value: unknown): Promise<void>;
  delete(id: string): Promise<void>;
};

export type ExtensionTemplatePreferencesApi = {
  isEnabled(templateKey: string): Promise<boolean>;
  setEnabled(templateKey: string, enabled: boolean): Promise<void>;
};

export type ExtensionStorageApi = {
  get(key: string): Promise<unknown | null>;
  set(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<void>;
  collection(name: string): ExtensionStorageCollection;
  templatePreferences: ExtensionTemplatePreferencesApi;
};

export type ExtensionFilesApi = {
  readText(path: string): Promise<string>;
  writeText(path: string, value: string): Promise<void>;
};

export type ExtensionReposApi = {
  list(): Promise<unknown[]>;
  getDefault(): Promise<unknown>;
  resolvePath(repoId: string, relativePath: string): Promise<string>;
};

export type ExtensionSetupContext = {
  projectId: string;
  storage: ExtensionStorageApi;
  files: ExtensionFilesApi;
  repos: ExtensionReposApi;
  commands: ExtensionCommandsApi;
};

export type ExtensionSetup = (ctx: ExtensionSetupContext) => void | Promise<void>;
export type ExtensionMigration = (ctx: ExtensionSetupContext, fromVersion: string) => void | Promise<void>;

export type HarnessDetectionResult = {
  available: boolean;
  reason?: string;
};

export type HarnessRun = {
  runId: string;
  onExit?: Promise<{ code: number | null; signal: string | null }>;
};

export type HarnessProviderDefinition = {
  id?: string;
  label: string;
  detect?(ctx: ExtensionSetupContext): Promise<HarnessDetectionResult>;
  start(
    ctx: ExtensionSetupContext,
    input: { workspacePath: string; sessionId: string; prompt?: string },
  ): Promise<HarnessRun>;
  send?(ctx: ExtensionSetupContext, input: { runId: string; message: string }): Promise<void>;
  stop?(ctx: ExtensionSetupContext, input: { runId: string }): Promise<void>;
};

export type WorkspaceTypeProviderDefinition = {
  id?: string;
  label: string;
  create(ctx: ExtensionSetupContext, input: Record<string, unknown>): Promise<Record<string, unknown>>;
  resolve(
    ctx: ExtensionSetupContext,
    workspace: Record<string, unknown>,
  ): Promise<{ rootPath: string; displayPath?: string }>;
  archive?(ctx: ExtensionSetupContext, workspace: Record<string, unknown>): Promise<void>;
  delete?(ctx: ExtensionSetupContext, workspace: Record<string, unknown>): Promise<void>;
};

export type ExtensionDefinition = {
  id: string;
  name: string;
  version?: string;
  resources?: Record<string, ResourceDefinition>;
  routes?: Record<string, RouteContribution>;
  views?: Record<string, ViewContribution>;
  slots?: Record<string, SlotDefinition>;
  commands?: Record<string, CommandDefinition>;
  events?: Record<string, EventHandlerDefinition>;
  settingsPanels?: Record<string, SettingsPanelContribution>;
  activityRenderers?: Record<string, ActivityRendererContribution>;
  sessionAnchorRenderers?: Record<string, SessionAnchorRendererContribution>;
  artifactMounts?: Record<string, ArtifactMountDefinition>;
  templates?: Record<string, TemplateDefinition>;
  templateTypes?: Record<string, TemplateTypeDefinition>;
  skills?: Record<string, SkillDefinition>;
  harnesses?: Record<string, HarnessProviderDefinition>;
  workspaceTypes?: Record<string, WorkspaceTypeProviderDefinition>;
  initialSetup?: ExtensionSetup;
  migrate?: ExtensionMigration;
};
