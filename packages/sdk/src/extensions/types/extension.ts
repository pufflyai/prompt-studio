import type { CommandRef } from "./commands";
import type {
  CommandMiddlewareHandler,
  CommandRunHandler,
  EventContext,
  ExtensionContextBase,
  MigrationContext,
  SetupContext,
} from "./context";
import type {
  ArtifactMountContribution,
  CliContribution,
  CommandPanelContribution,
  MenuContribution,
  NavigationContribution,
  RendererContribution,
  RouteContribution,
  SettingsPanelContribution,
  SkillContribution,
  TemplateContribution,
  TemplateTypeContribution,
  ViewContribution,
  WebviewContribution,
} from "./contributions";
import type { EventRef } from "./events";
import type { JsonObject, MaybePromise, Struct } from "./json";
import type { ParamObjectSchema } from "./params";
import type { SlotRef } from "./slots";

export interface CommandDefinition<TParams extends Struct = Struct, TResult = unknown> {
  title: string;
  description?: string;
  params?: ParamObjectSchema;
  /** Defaults to true. */
  commandPanel?: boolean | CommandPanelContribution;
  menus?: MenuContribution[];
  cli?: boolean | CliContribution;
  run: CommandRunHandler<TParams, TResult>;
}

export interface MiddlewareDefinition<TParams extends Struct = Struct, TResult = unknown> {
  command: CommandRef<TParams, TResult> | string;
  handler: CommandMiddlewareHandler<TParams>;
}

export interface HookDefinition<TPayload extends Struct = Struct> {
  event: EventRef<TPayload> | string;
  handler(ctx: EventContext, payload: TPayload): MaybePromise<void>;
}

export interface ScheduleContribution<TParams extends Struct = Struct> {
  title: string;
  cron: string;
  command: CommandRef<TParams, unknown> | string;
  params?: TParams;
  repoId?: string;
  disabled?: boolean;
}

export interface HarnessDetectionResult {
  available: boolean;
  version?: string;
  reason?: string;
}

export interface HarnessRun {
  runId: string;
  pid?: number;
  metadata?: JsonObject;
}

export interface HarnessProvider {
  id: string;
  label: string;
  detect?(ctx: ExtensionContextBase): MaybePromise<HarnessDetectionResult>;
  start(
    ctx: ExtensionContextBase,
    input: { workspacePath: string; sessionId: string; prompt?: string },
  ): MaybePromise<HarnessRun>;
  send?(ctx: ExtensionContextBase, input: { runId: string; message: string }): MaybePromise<void>;
  stop?(ctx: ExtensionContextBase, input: { runId: string }): MaybePromise<void>;
}

export interface WorkspaceTypeProvider {
  id: string;
  label: string;
  create(ctx: ExtensionContextBase, input: JsonObject): MaybePromise<JsonObject>;
  resolve(ctx: ExtensionContextBase, workspace: JsonObject): MaybePromise<{ rootPath: string; displayPath?: string }>;
  archive?(ctx: ExtensionContextBase, workspace: JsonObject): MaybePromise<void>;
  delete?(ctx: ExtensionContextBase, workspace: JsonObject): MaybePromise<void>;
}

export interface LocalExtensionSource {
  name: string;
  path: string;
  origin?: string;
  installedAt: string;
  updatedAt: string;
}

export interface ProjectExtensionInstance {
  projectId: string;
  extensionId: string;
  namespace: string;
  sourceName: string;
  enabled: boolean;
  config: JsonObject;
}

export interface ExtensionDefinition {
  id: string;
  namespace: string;
  name: string;
  version?: string;
  description?: string;
  settings?: ParamObjectSchema;

  slots?: Record<string, SlotRef>;
  routes?: Record<string, RouteContribution>;
  views?: Record<string, ViewContribution>;
  menus?: Record<string, MenuContribution>;
  navigation?: Record<string, NavigationContribution>;
  settingsPanels?: Record<string, SettingsPanelContribution>;
  activityRenderers?: Record<string, RendererContribution | WebviewContribution>;
  sessionAnchorRenderers?: Record<string, RendererContribution | WebviewContribution>;

  // biome-ignore lint/suspicious/noExplicitAny: heterogeneous command shapes
  commands?: Record<string, CommandDefinition<any, any>>;
  // biome-ignore lint/suspicious/noExplicitAny: heterogeneous middleware shapes
  middlewares?: Record<string, MiddlewareDefinition<any, any>>;
  // biome-ignore lint/suspicious/noExplicitAny: heterogeneous hook shapes
  hooks?: Record<string, HookDefinition<any>>;
  // biome-ignore lint/suspicious/noExplicitAny: heterogeneous schedule shapes
  schedules?: Record<string, ScheduleContribution<any>>;

  artifactMounts?: Record<string, ArtifactMountContribution>;
  templateTypes?: Record<string, TemplateTypeContribution>;
  templates?: Record<string, TemplateContribution>;
  skills?: Record<string, SkillContribution>;

  workspaceTypes?: Record<string, WorkspaceTypeProvider>;
  harnesses?: Record<string, HarnessProvider>;

  initialSetup?: (ctx: SetupContext) => MaybePromise<void>;
  migrate?: (ctx: MigrationContext, fromVersion: string | null) => MaybePromise<void>;
}

export type ExtensionSourceKind = "local" | "package" | "builtin";
