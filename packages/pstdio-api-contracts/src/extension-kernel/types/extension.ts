import type { Localizable } from "../l10n";
import type { CommandRef } from "./commands";
import type { ResourceHierarchyProvider, ResourceKindDefinition, ResourceViewContribution } from "./composition";
import type { CommandMiddlewareHandler, CommandRunHandler, EventContext, ExtensionContextBase } from "./context";
import type { ContributionDefinition } from "./contribution-identity";
import type {
  ActivityItemContribution,
  ArtifactMountContribution,
  CliContribution,
  CommandPaletteContribution,
  CommandPaletteResourceContribution,
  ExtensionSettingsContribution,
  FileIconThemeContribution,
  KeybindingContribution,
  MenuContribution,
  ModeContribution,
  SettingsPanelContribution,
  SettingsSectionContribution,
  SkillContribution,
  TemplateContribution,
  TemplateTypeContribution,
  ThemeContribution,
} from "./contributions";
import type { EventRef } from "./events";
import type { HarnessProvider } from "./harness";
import type { JsonObject, MaybePromise, Struct } from "./json";
import type { PageContribution } from "./pages";
import type { ParamObjectSchema, ParamsOf } from "./params";
import type { PackageAssetDescriptor } from "./resources";
import type { StatusBarItemContribution, StatusContribution } from "./statuses";
import type {
  NavigationItemContribution,
  PlacementContribution,
  ViewContribution,
  ViewMenuContribution,
} from "./views";

/** Current host extension API version. `engines.pstdio` in package.json is a semver range checked against this. */
// While the API is unstable the version carries an `-alpha.N` suffix and extensions must
// declare it exactly. Bump the alpha in the same change that breaks an extension contract.
export const EXTENSION_API_VERSION = "1.0.0-alpha.7";

type SchemaParams<TSchema extends ParamObjectSchema | undefined> = TSchema extends ParamObjectSchema
  ? ParamsOf<TSchema>
  : Struct;

export interface WorkspaceProviderRef {
  version: number;
  data: JsonObject;
}

export interface WorkspaceProviderCreateInput {
  operationId: string;
  projectId: string;
  workspaceId: string;
  params: JsonObject;
  /** Host-owned cancellation for the workspace creation request. */
  signal?: AbortSignal;
}

export interface WorkspaceProviderResolveInput {
  projectId: string;
  workspaceId: string;
  providerRef: WorkspaceProviderRef;
}

export interface WorkspaceProviderMutationInput extends WorkspaceProviderResolveInput {
  operationId: string;
}

export type WorkspaceProviderState =
  | "provisioning"
  | "ready"
  | "failed"
  | "cancelled"
  | "archiving"
  | "archived"
  | "deleting"
  | "provider_missing";

export type WorkspaceExecutionTarget =
  | {
      kind: "local";
      rootPath: string;
      displayPath?: string;
    }
  | {
      kind: "remote";
      providerId: string;
      providerRef: WorkspaceProviderRef;
      displayPath?: string;
    };

export interface WorkspaceCapabilities {
  files: "none" | "read" | "write";
  diff: boolean;
  merge: boolean;
  rebase: boolean;
  archive: boolean;
  delete: boolean;
}

export interface WorkspaceProviderResult {
  providerRef?: WorkspaceProviderRef;
  /** Git branch exposed to host merge and diff features. Provider refs stay opaque. */
  branch?: string;
  state: WorkspaceProviderState;
  executionKind: "local" | "remote";
  executionTarget?: WorkspaceExecutionTarget;
  displayPath?: string;
  capabilities: WorkspaceCapabilities;
  error?: {
    code: string;
    message: string;
    retryable: boolean;
  };
}

/**
 * A command exposed by an extension. The `params` schema (typed via `params.*`) drives
 * the inferred shape of the second argument passed to `run`.
 */
export interface CommandDefinition<
  TSchema extends ParamObjectSchema | undefined = ParamObjectSchema | undefined,
  TResult = unknown,
  TSettings extends Record<string, unknown> = Record<string, unknown>,
> extends ContributionDefinition<"command"> {
  title: Localizable<string>;
  description?: Localizable<string>;
  params?: TSchema;
  menus?: readonly MenuContribution[];
  palette?: readonly CommandPaletteContribution<SchemaParams<TSchema>>[];
  cli?: true | CliContribution;
  /** Exposes this exact command and its params schema to scoped machine tokens. */
  automation?: true;
  /** Records CLI invocations of this command as mutations. */
  mutating?: true;
  run: CommandRunHandler<SchemaParams<TSchema>, TResult, TSettings>;
}

/**
 * Middleware that runs before a command.
 */
export interface MiddlewareDefinition<TParams extends Struct = Struct, TResult = unknown>
  extends ContributionDefinition<"middleware"> {
  command: CommandRef<TParams, TResult>;
  run: CommandMiddlewareHandler<TParams>;
}

/**
 * A handler for an event.
 */
export interface HookDefinition<TPayload extends Struct = Struct> extends ContributionDefinition<"hook"> {
  event: EventRef<TPayload>;
  run(ctx: EventContext, payload: TPayload): MaybePromise<void>;
}

export interface RepoRef {
  readonly id: string;
}

export type ScheduleExpression = string;

export interface ScheduleContribution<TParams extends Struct = Struct> extends ContributionDefinition<"schedule"> {
  title: Localizable<string>;
  schedule: ScheduleExpression;
  command: CommandRef<TParams, unknown>;
  params?: TParams;
  repo?: RepoRef;
  disabled?: boolean;
}

export interface WorkspaceTypeProvider extends ContributionDefinition<"workspace-type"> {
  label: Localizable<string>;
  params?: ParamObjectSchema;
  create(ctx: ExtensionContextBase, input: WorkspaceProviderCreateInput): MaybePromise<WorkspaceProviderResult>;
  resolve(ctx: ExtensionContextBase, input: WorkspaceProviderResolveInput): MaybePromise<WorkspaceProviderResult>;
  cancel?(ctx: ExtensionContextBase, input: WorkspaceProviderMutationInput): MaybePromise<WorkspaceProviderResult>;
  archive?(ctx: ExtensionContextBase, input: WorkspaceProviderMutationInput): MaybePromise<WorkspaceProviderResult>;
  delete?(ctx: ExtensionContextBase, input: WorkspaceProviderMutationInput): MaybePromise<void>;
}

export interface ExtensionConnectionContribution extends ContributionDefinition<"connection"> {
  label: Localizable<string>;
  transport: "http";
  auth: { type: "bearer" } | { type: "header"; headerName: string };
  allowedMethods: readonly ("GET" | "POST" | "PUT" | "PATCH" | "DELETE")[];
  allowedPathPrefixes: readonly string[];
  check?: {
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    path: string;
  };
  supportsStreaming?: boolean;
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

/** UI surface contributions: views, typed references, and placements. */
export interface UiContributions {
  views?: readonly ViewContribution[];
  viewMenus?: readonly ViewMenuContribution[];
  placements?: readonly PlacementContribution[];
  navigationItems?: readonly NavigationItemContribution[];
  statusBarItems?: readonly StatusBarItemContribution[];
  statuses?: readonly StatusContribution[];
  modes?: readonly ModeContribution[];
  pages?: readonly PageContribution[];
  resourceKinds?: readonly ResourceKindDefinition[];
  resourceViews?: readonly ResourceViewContribution[];
  activityItems?: readonly ActivityItemContribution[];
  settingsSections?: readonly SettingsSectionContribution[];
  settingsPanels?: readonly SettingsPanelContribution[];
  commandPaletteResources?: readonly CommandPaletteResourceContribution[];
  // biome-ignore lint/suspicious/noExplicitAny: heterogeneous keybinding shapes
  keybindings?: readonly KeybindingContribution<any>[];
}

/** Behavioural surface: commands, middleware, hooks, schedules. */
export interface BehaviourContributions {
  // biome-ignore lint/suspicious/noExplicitAny: heterogeneous command shapes
  commands?: readonly CommandDefinition<any, any, any>[];
  // biome-ignore lint/suspicious/noExplicitAny: heterogeneous middleware shapes
  middlewares?: readonly MiddlewareDefinition<any, any>[];
  // biome-ignore lint/suspicious/noExplicitAny: heterogeneous hook shapes
  hooks?: readonly HookDefinition<any>[];
  // biome-ignore lint/suspicious/noExplicitAny: heterogeneous schedule shapes
  schedules?: readonly ScheduleContribution<any>[];
}

/** Static asset contributions: artifact mounts, templates, skills. */
export interface AssetContributions {
  artifactMounts?: readonly ArtifactMountContribution[];
  templateTypes?: readonly TemplateTypeContribution[];
  templates?: readonly TemplateContribution[];
  skills?: readonly SkillContribution[];
  themes?: readonly ThemeContribution[];
  fileIconThemes?: readonly FileIconThemeContribution[];
  translations?: Record<string, PackageAssetDescriptor>;
  defaultLocale?: string;
}

/** Provider contributions: harnesses, workspace types. */
export interface ProviderContributions {
  connections?: readonly ExtensionConnectionContribution[];
  workspaceTypes?: readonly WorkspaceTypeProvider[];
  harnesses?: readonly HarnessProvider[];
  resourceHierarchyProviders?: readonly ResourceHierarchyProvider[];
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
    ProviderContributions {
  settings?: ExtensionSettingsContribution;
}

export type ExtensionSourceKind = "local_path" | "git" | "registry";
