import type { Localizable } from "../l10n";
import type { CommandRef, CommandSource } from "./commands";
import type { RendererCallback } from "./context";
import type {
  ContributionDefinition,
  ModeRef,
  ResourceKindRef,
  SettingsSectionRef,
  SettingsSlotRef,
  ViewRef,
} from "./contribution-identity";
import type { JsonObject, JsonValue, Struct } from "./json";
import type { NavigationTarget } from "./navigation-target";
import type { RendererEventReference } from "./renderer-base";
import type { PackageAssetDescriptor, ResourceRef } from "./resources";
import type { SlotRef } from "./slots";
import type { WebviewCapabilityDeclaration } from "./webview-capabilities";

export type * from "./kanban-renderer";

export interface CliContribution {
  path?: string[];
  globalAliases?: string[][];
  description?: Localizable<string>;
  examples?: string[];
  hidden?: boolean;
}

export interface WhenExpression {
  mode?: ModeRef | readonly ModeRef[];
  source?: CommandSource[];
  view?: ViewRef | readonly ViewRef[];
  resourceType?: readonly ResourceKindRef[];
  metadata?: JsonObject;
}

export interface MenuContribution<TSlotContext extends Struct = Struct, TParams extends Struct = Struct> {
  slot: SlotRef<TSlotContext, "menu">;
  label?: Localizable<string>;
  group?: string;
  placement?: "first" | "default" | "last";
  icon?: string;
  when?: WhenExpression;
  params?: Partial<TParams>;
  presentation?: "menu-item" | "button" | "icon-button";
}

export interface CommandPaletteContribution<TParams extends Struct = Struct> {
  label?: Localizable<string>;
  group?: string;
  placement?: "first" | "default" | "last";
  icon?: string;
  when?: WhenExpression;
  params?: Partial<TParams>;
}

// An icon-only action in the workbench activity rail. The host renders the rail
// natively for the declared modes; there is no webview involved.
export interface ActivityItemContribution<TParams extends Struct = Struct>
  extends ContributionDefinition<"activity-item"> {
  title: Localizable<string>;
  icon: string;
  /** Mode ids whose activity rail shows this item. */
  modes: readonly ModeRef[];
  placement?: "first" | "default" | "last";
  command: CommandRef<TParams, unknown>;
  params?: Partial<TParams>;
}

export interface ModeContribution extends ContributionDefinition<"mode"> {
  label: Localizable<string>;
  icon?: string;
}

export interface WebviewContribution {
  entry: PackageAssetDescriptor;
  title?: Localizable<string>;
  capabilities?: WebviewCapabilityDeclaration[];
}

export interface SettingsPanelContribution extends ContributionDefinition<"settings-panel"> {
  view: ViewRef;
  slot: SettingsSlotRef;
  section?: SettingsSectionRef;
}

/** A named group in the settings navigation that an extension's panels can sit under. */
export interface SettingsSectionContribution extends ContributionDefinition<"settings-section"> {
  title: Localizable<string>;
  /** Lower sorts first among sibling sections. */
  order?: number;
}

/**
 * Command palette resource providers contribute dynamic, searchable palette results
 * (e.g. slides in a presentation) backed by a private query callback. The host queries
 * matching providers as the user types and refreshes results when a declared event fires.
 */
export interface CommandPaletteResourceQueryParams {
  projectId?: string;
  modeId?: string;
  activeResource?: ResourceRef;
  providerId: string;
  query: string;
  limit: number;
}

export type CommandPaletteResourceTarget = NavigationTarget;

export interface CommandPaletteResourceItem {
  id: string;
  label: string;
  description?: string;
  icon?: string;
  keywords?: string[];
  target: CommandPaletteResourceTarget;
}

export interface CommandPaletteResourceQueryResult {
  items: CommandPaletteResourceItem[];
}

export interface CommandPaletteResourceContribution extends ContributionDefinition<"command-palette-resource"> {
  title: Localizable<string>;
  resourceKind?: ResourceKindRef;
  query: RendererCallback<CommandPaletteResourceQueryParams, CommandPaletteResourceQueryResult>;
  refreshEvents?: readonly RendererEventReference[];
}

export type ExtensionSettingScope = "global" | "project";
export type ExtensionSettingValueType = "boolean" | "number" | "string" | "array" | "object";

export type ExtensionSettingValueForType<TType extends ExtensionSettingValueType> = TType extends "boolean"
  ? boolean
  : TType extends "number"
    ? number
    : TType extends "string"
      ? string
      : TType extends "array"
        ? JsonValue[]
        : JsonObject;

export type ExtensionSettingProperty<TType extends ExtensionSettingValueType = ExtensionSettingValueType> = {
  [TSettingType in TType]: {
    type: TSettingType;
    scope: ExtensionSettingScope;
    default?: ExtensionSettingValueForType<TSettingType>;
    enum?: ExtensionSettingValueForType<TSettingType>[];
    title?: Localizable<string>;
    description?: Localizable<string>;
  };
}[TType];

export interface ExtensionSettingsContribution<
  TProperties extends Record<string, ExtensionSettingProperty> = Record<string, ExtensionSettingProperty>,
> {
  properties: TProperties;
}

export interface ArtifactMountContribution extends ContributionDefinition<"artifact-mount"> {
  /** Relative path under .pstdio/<extension.name>/. */
  path: string;
  label: Localizable<string>;
  repoRole?: "default" | "selected" | "workspace";
}

export interface TemplateTypeContribution extends ContributionDefinition<"template-type"> {
  label: Localizable<string>;
  description?: Localizable<string>;
  order?: number;
  commands?: {
    list: CommandRef;
    read: CommandRef;
    save: CommandRef;
    delete: CommandRef;
  };
}

export interface TemplateContribution extends ContributionDefinition<"template"> {
  title: Localizable<string>;
  type: string;
  source: PackageAssetDescriptor;
  description?: Localizable<string>;
}

export interface SkillContribution extends ContributionDefinition<"skill"> {
  title: Localizable<string>;
  source: PackageAssetDescriptor;
  description?: Localizable<string>;
}

export type ThemeMode = "light" | "dark";

export interface ThemeContribution extends ContributionDefinition<"theme"> {
  title: Localizable<string>;
  source: PackageAssetDescriptor;
  format: "vscode-color-theme";
  mode?: ThemeMode;
  description?: Localizable<string>;
}

export interface FileIconThemeContribution extends ContributionDefinition<"file-icon-theme"> {
  title: Localizable<string>;
  source: PackageAssetDescriptor;
  format: "vscode-file-icon-theme";
  description?: Localizable<string>;
}

/**
 * Chord string in TanStack Hotkeys syntax (e.g. "mod+shift+p"). `mod` is
 * Cmd on macOS and Ctrl elsewhere. Parsing, validation, canonicalization,
 * and display labels are all delegated to `@tanstack/hotkeys`.
 */
export type KeybindingChord = string;

export interface KeybindingContribution<TParams extends Struct = Struct> extends ContributionDefinition<"keybinding"> {
  /** Default chord. Used on every platform unless an override is provided. */
  key: KeybindingChord;
  /** macOS override. */
  mac?: KeybindingChord;
  /** Linux override. */
  linux?: KeybindingChord;
  /** Windows override. */
  win?: KeybindingChord;
  /** Command this chord executes. */
  command: CommandRef<TParams, unknown>;
  /** Optional command params. */
  params?: Partial<TParams>;
  /** Optional gating predicate. The host evaluates it at dispatch time. */
  when?: WhenExpression;
}
