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
  FileIconThemeContribution,
  MenuContribution,
  NavigationContribution,
  RendererContribution,
  RouteContribution,
  SettingsPanelContribution,
  SkillContribution,
  TemplateContribution,
  TemplateTypeContribution,
  ThemeContribution,
  ViewContribution,
} from "./contributions";
import type { EventRef } from "./events";
import type { JsonObject, MaybePromise, Struct } from "./json";
import type { ParamObjectSchema, ParamsOf } from "./params";
import type { SlotRef } from "./slots";

/** API version of an extension's manifest. The runtime uses this to detect old extensions. */
export type ExtensionApiVersion = "1";

type SchemaParams<TSchema extends ParamObjectSchema | undefined> = TSchema extends ParamObjectSchema
  ? ParamsOf<TSchema>
  : Struct;

/**
 * A command exposed by an extension. The `params` schema (typed via `params.*`) drives
 * the inferred shape of `ctx.params` in `run`.
 */
export interface CommandDefinition<
  TSchema extends ParamObjectSchema | undefined = ParamObjectSchema | undefined,
  TResult = unknown,
> {
  title: string;
  description?: string;
  params?: TSchema;
  menus?: MenuContribution[];
  cli?: boolean | CliContribution;
  run: CommandRunHandler<SchemaParams<TSchema>, TResult>;
}

/**
 * Middleware that runs before a command. Use `command` for a typed `CommandRef`; use
 * `commandId` only when referencing a command from another extension you don't import.
 */
export interface MiddlewareDefinition<TParams extends Struct = Struct, TResult = unknown> {
  command?: CommandRef<TParams, TResult>;
  commandId?: string;
  handler: CommandMiddlewareHandler<TParams>;
}

/**
 * A handler for an event. Use `event` for a typed `EventRef`; use `eventId` for events
 * you cannot import (e.g. originating in another extension).
 */
export interface HookDefinition<TPayload extends Struct = Struct> {
  event?: EventRef<TPayload>;
  eventId?: string;
  handler(ctx: EventContext, payload: TPayload): MaybePromise<void>;
}

export interface ScheduleContribution<TParams extends Struct = Struct> {
  title: string;
  cron: string;
  command?: CommandRef<TParams, unknown>;
  commandId?: string;
  params?: TParams;
  repoId?: string;
  repoPath?: string;
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

/** Identifying metadata for an extension. */
export interface ExtensionMetadata {
  id: string;
  namespace: string;
  name: string;
  version?: string;
  description?: string;
  /** Manifest API version. The runtime uses this to detect incompatible extensions. */
  apiVersion: ExtensionApiVersion;
  settings?: ParamObjectSchema;
}

/** UI surface contributions: slots, routes, panels, renderers. */
export interface UiContributions {
  slots?: Record<string, SlotRef>;
  routes?: Record<string, RouteContribution>;
  views?: Record<string, ViewContribution>;
  navigation?: Record<string, NavigationContribution>;
  settingsPanels?: Record<string, SettingsPanelContribution>;
  activityRenderers?: Record<string, RendererContribution>;
  sessionAnchorRenderers?: Record<string, RendererContribution>;
}

/** Behavioural surface: commands, middleware, hooks, schedules. */
export interface BehaviourContributions {
  // biome-ignore lint/suspicious/noExplicitAny: heterogeneous command shapes
  commands?: Record<string, CommandDefinition<any, any>>;
  // biome-ignore lint/suspicious/noExplicitAny: heterogeneous middleware shapes
  middlewares?: Record<string, MiddlewareDefinition<any, any>>;
  // biome-ignore lint/suspicious/noExplicitAny: heterogeneous hook shapes
  hooks?: Record<string, HookDefinition<any>>;
  // biome-ignore lint/suspicious/noExplicitAny: heterogeneous schedule shapes
  schedules?: Record<string, ScheduleContribution<any>>;
}

/** Static asset contributions: artifact mounts, templates, skills. */
export interface AssetContributions {
  artifactMounts?: Record<string, ArtifactMountContribution>;
  templateTypes?: Record<string, TemplateTypeContribution>;
  templates?: Record<string, TemplateContribution>;
  skills?: Record<string, SkillContribution>;
  themes?: Record<string, ThemeContribution>;
  fileIconThemes?: Record<string, FileIconThemeContribution>;
}

/** Provider contributions: harnesses, workspace types. */
export interface ProviderContributions {
  workspaceTypes?: Record<string, WorkspaceTypeProvider>;
  harnesses?: Record<string, HarnessProvider>;
}

/** Lifecycle hooks invoked by the runtime when an extension is installed or upgraded. */
export interface ExtensionLifecycle {
  initialSetup?: (ctx: SetupContext) => MaybePromise<void>;
  migrate?: (ctx: MigrationContext, fromVersion: string | null) => MaybePromise<void>;
}

/**
 * The full shape of an extension manifest. Composed from focused capability mixins so
 * each surface is independently discoverable.
 */
export interface ExtensionDefinition
  extends ExtensionMetadata,
    UiContributions,
    BehaviourContributions,
    AssetContributions,
    ProviderContributions,
    ExtensionLifecycle {}

export type ExtensionSourceKind = "local" | "package" | "builtin";
