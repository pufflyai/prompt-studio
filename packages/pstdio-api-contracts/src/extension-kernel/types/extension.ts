import type { Localizable } from "../l10n";
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
  CommandPaletteContribution,
  CommandPaletteResourceContribution,
  ExtensionSettingsContribution,
  FileIconThemeContribution,
  KanbanRendererContribution,
  KeybindingContribution,
  MenuContribution,
  ModeContribution,
  PanelContribution,
  RendererContribution,
  RouteContribution,
  SettingsPanelContribution,
  SkillContribution,
  TemplateContribution,
  TemplateTypeContribution,
  ThemeContribution,
  TreeItemContribution,
} from "./contributions";
import type { ControlsRendererContribution } from "./controls";
import type { DataTableRendererContribution } from "./data-table-renderer";
import type { EventRef } from "./events";
import type { FileRendererContribution } from "./file-renderer";
import type { HarnessProvider } from "./harness";
import type { JsonObject, MaybePromise, Struct } from "./json";
import type { ParamObjectSchema, ParamsOf } from "./params";
import type { PackageAssetDescriptor } from "./resources";
import type { TreeRendererContribution } from "./tree-renderer";

/** Current host extension API version. `engines.pstdio` in package.json is a semver range checked against this. */
export const EXTENSION_API_VERSION = "1.0.0";

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
  TSettings extends Record<string, unknown> = Record<string, unknown>,
> {
  title: Localizable<string>;
  description?: Localizable<string>;
  params?: TSchema;
  menus?: MenuContribution[];
  palette?:
    | boolean
    | CommandPaletteContribution<SchemaParams<TSchema>>
    | CommandPaletteContribution<SchemaParams<TSchema>>[];
  cli?: boolean | CliContribution;
  run: CommandRunHandler<SchemaParams<TSchema>, TResult, TSettings>;
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
  title: Localizable<string>;
  cron: string;
  command?: CommandRef<TParams, unknown>;
  commandId?: string;
  params?: TParams;
  repoId?: string;
  repoPath?: string;
  disabled?: boolean;
}

export interface WorkspaceTypeProvider {
  id: string;
  label: Localizable<string>;
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

export type ExtensionLoadScope = "user" | "repo";

/** Validated panel of an extension's package.json identity fields. */
export interface PackageManifest {
  /** Extension package name. Matches `^[a-z][a-z0-9-]*$`. */
  name: string;
  /** Package version (semver). */
  version: string;
  /** Optional human-friendly name. Falls back to `name`. */
  displayName?: string;
  /** Optional package description. */
  description?: string;
  /** Publisher segment of the extension id. Matches `^[a-z][a-z0-9-]*$`. */
  publisher: string;
  /** Relative path to the contributions entry module. */
  main: string;
  /** Semver range checked against the host extension API version. */
  enginesPstdio: string;
  /** Prompt Studio-specific package metadata. */
  pstdio?: {
    /** Install/load scope. Defaults to "user" when omitted. */
    scope?: ExtensionLoadScope;
  };
  /** Derived `${publisher}.${name}`. */
  id: string;
}

/** UI surface contributions: modes, routes, panels, renderers. */
export interface UiContributions {
  modes?: Record<string, ModeContribution>;
  routes?: Record<string, RouteContribution>;
  panels?: Record<string, PanelContribution>;
  treeItems?: Record<string, TreeItemContribution>;
  treeRenderers?: Record<string, TreeRendererContribution>;
  fileRenderers?: Record<string, FileRendererContribution>;
  controlsRenderers?: Record<string, ControlsRendererContribution>;
  settingsPanels?: Record<string, SettingsPanelContribution>;
  kanbanRenderers?: Record<string, KanbanRendererContribution>;
  dataTableRenderers?: Record<string, DataTableRendererContribution>;
  commandPaletteResources?: Record<string, CommandPaletteResourceContribution>;
  // biome-ignore lint/suspicious/noExplicitAny: heterogeneous keybinding shapes
  keybindings?: Record<string, KeybindingContribution<any>>;
  activityRenderers?: Record<string, RendererContribution>;
  sessionAnchorRenderers?: Record<string, RendererContribution>;
}

/** Behavioural surface: commands, middleware, hooks, schedules. */
export interface BehaviourContributions {
  // biome-ignore lint/suspicious/noExplicitAny: heterogeneous command shapes
  commands?: Record<string, CommandDefinition<any, any, any>>;
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
  translations?: Record<string, PackageAssetDescriptor>;
  defaultLocale?: string;
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
 * The full shape of an extension's contributions module. Identity (id, name, version,
 * description, etc.) lives in `package.json`; `defineExtension` only accepts
 * contribution surfaces.
 */
export interface ExtensionDefinition
  extends UiContributions,
    BehaviourContributions,
    AssetContributions,
    ProviderContributions,
    ExtensionLifecycle {
  settings?: ExtensionSettingsContribution;
}

export type ExtensionSourceKind = "local_path" | "git" | "registry";
