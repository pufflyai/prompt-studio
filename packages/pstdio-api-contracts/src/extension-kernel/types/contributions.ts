import type { Localizable } from "../l10n";
import type {
  WorkbenchMenuTarget,
  WorkbenchModePanel,
  WorkbenchSettingsScope,
  WorkbenchSettingsTarget,
  WorkbenchTreeTarget,
} from "../workbench-targets";
import type { CommandRef, CommandSource } from "./commands";
import type {
  ModeDefaultResource,
  ModePlacementContribution,
  ModeResourceRecipeContribution,
  PanelPlacementContribution,
} from "./composition";
import type { RendererCallback } from "./context";
import type { JsonObject, JsonValue, Struct } from "./json";
import type { ExtensionNavigationTarget } from "./navigation-target";
import type { ParamObjectSchema } from "./params";
import type { RendererContributionBase, RendererEventReference } from "./renderer-base";
import type { PackageAssetDescriptor, RendererContext, ResourceRef } from "./resources";
import type { SlotRef } from "./slots";
import type { WebviewCapabilityDeclaration } from "./webview-capabilities";

export interface CliContribution {
  path?: string[];
  globalAliases?: string[][];
  description?: Localizable<string>;
  examples?: string[];
  hidden?: boolean;
}

export interface WhenExpression {
  mode?: string | string[];
  source?: CommandSource[];
  viewId?: string | string[];
  resourceType?: string[];
  metadata?: JsonObject;
}

export interface MenuContribution<TSlotContext extends Struct = Struct, TParams extends Struct = Struct> {
  target?: WorkbenchMenuTarget;
  slot?: SlotRef<TSlotContext, "menu"> | string;
  label?: Localizable<string>;
  group?: string;
  placement?: "first" | "default" | "last";
  icon?: string;
  when?: WhenExpression;
  command?: CommandRef<TParams, unknown> | string;
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
export interface ActivityItemContribution<TParams extends Struct = Struct> {
  title: Localizable<string>;
  icon: string;
  /** Mode ids whose activity rail shows this item. */
  modes: readonly string[];
  placement?: "first" | "default" | "last";
  command: CommandRef<TParams, unknown> | string;
  params?: Partial<TParams>;
}

export interface TreeItemContribution<TParams extends Struct = Struct> {
  target: WorkbenchTreeTarget;
  label: Localizable<string>;
  /** `null` places the item at the tree root without a section heading. */
  group?: string | null;
  placement?: "first" | "default" | "last";
  icon?: string;
  when?: WhenExpression;
  action:
    | {
        kind: "command";
        command: CommandRef<TParams, unknown> | string;
        params?: Partial<TParams>;
      }
    | { kind: "view"; viewId: string }
    | { kind: "resource"; resource: ResourceRef }
    | { kind: "href"; href: string };
}

export interface ModeContribution {
  id?: string;
  label: Localizable<string>;
  icon?: string;
  /** Host panel regions this mode exposes (chrome availability, not persisted layout). */
  panelRegions?: readonly WorkbenchModePanel[];
  /** Contextual placement recipes. Keys are local or namespaced resource-kind ids. */
  resources?: Record<string, ModeResourceRecipeContribution>;
  /** Mode-wide panels that do not consume the active resource. */
  modePanels?: Record<string, ModePlacementContribution>;
  defaultResource?: ModeDefaultResource;
}

export interface WebviewContribution {
  entry: PackageAssetDescriptor;
  title?: Localizable<string>;
  capabilities?: WebviewCapabilityDeclaration[];
}

export type HostTreeDefault = "default" | "none";

interface PanelMenuContributionBase {
  title: Localizable<string>;
  side: "left" | "right";
  group?: string;
  placement?: "first" | "default" | "last";
  hostTreeHeader?: HostTreeDefault;
  hostTreeFooter?: HostTreeDefault;
}

export type NativeRendererKind = "tree" | "file" | "controls" | "dataTable" | "kanban";

export interface RendererRef {
  kind: NativeRendererKind;
  id: string;
}

type PanelBody =
  | {
      webview: WebviewContribution;
      renderer?: never;
    }
  | {
      webview?: never;
      renderer: RendererRef;
    };

export interface PanelContributionBase {
  title: Localizable<string>;
  /** Optional project-relative deep-link path for opening this panel as a view. */
  path?: string;
  /** Icon shown on the panel's tab and on resources opened for the panel. */
  icon?: string;
  /** Default placement for resource kinds owned by this extension, or for its modes. */
  show?: PanelPlacementContribution | readonly PanelPlacementContribution[];
  panelMenus?: Record<string, PanelMenuContribution>;
}

export type PanelMenuContribution = PanelMenuContributionBase & PanelBody;
export type PanelContribution = PanelContributionBase & PanelBody;

// A status item is a chrome contribution: the host renders it in the status surface
// and it takes no part in docked layout or persisted placement.
export interface StatusItemContribution {
  title: Localizable<string>;
  when?: WhenExpression;
  webview: WebviewContribution;
}

export interface RouteContribution {
  path: string;
  label: Localizable<string>;
  webview: WebviewContribution;
}

export interface SettingsPanelContribution<TSlotContext extends Struct = Struct> {
  title: Localizable<string>;
  target?: WorkbenchSettingsTarget;
  scope?: WorkbenchSettingsScope;
  slot?: SlotRef<TSlotContext, "settings"> | string;
  icon?: string;
  /** Key of a `settingsSections` entry. Unset panels fall back to the host's scope section. */
  section?: string;
  webview: WebviewContribution;
}

/** A named group in the settings navigation that an extension's panels can sit under. */
export interface SettingsSectionContribution {
  title: Localizable<string>;
  scope?: WorkbenchSettingsScope;
  /** Lower sorts first among sibling sections. */
  order?: number;
}

export type KanbanRendererViewMode = "board" | "list";
export type KanbanRendererSortDirection = "asc" | "desc";

export interface KanbanRendererEnumOption {
  value: string;
  label: Localizable<string>;
  color?: string;
  icon?: string | null;
}

export type KanbanRendererAttributeType =
  | { kind: "enum"; options: KanbanRendererEnumOption[] }
  | { kind: "enum-multi"; options: KanbanRendererEnumOption[] }
  | { kind: "string" }
  | { kind: "date" }
  | { kind: "number" }
  | { kind: "user" };

export type KanbanRendererAttributeDisplay = { kind: "workspace-badge"; itemsAttributeId: string };

export interface KanbanRendererAttributeDescriptor {
  id: string;
  label: Localizable<string>;
  type: KanbanRendererAttributeType;
  filterable?: boolean;
  groupable?: boolean;
  sortable?: boolean;
  displayable?: boolean;
  editable?: boolean;
  display?: KanbanRendererAttributeDisplay;
}

export interface KanbanRendererSettings {
  viewMode: KanbanRendererViewMode;
  columnGrouping: string;
  rowGrouping: string;
  ordering: {
    attributeId: string;
    direction: KanbanRendererSortDirection;
  };
  displayProperties: string[];
}

export type KanbanRendererFilterState = Record<string, string[]>;

export interface KanbanRendererSavedView {
  id: string;
  title: Localizable<string>;
  settings: KanbanRendererSettings;
  filters: KanbanRendererFilterState;
  isDefault?: boolean;
}

export interface KanbanRendererQueryParams {
  renderer: RendererContext;
  settings: KanbanRendererSettings;
  filters: KanbanRendererFilterState;
}

export type KanbanRendererResourceRef = ResourceRef;

export interface KanbanRendererRow {
  id: string;
  title: string;
  resource?: KanbanRendererResourceRef;
  attributes: Record<string, unknown>;
}

export interface KanbanRendererColumnAction {
  id: string;
  label: Localizable<string>;
  icon?: string;
}

export interface KanbanRendererBoardColumnConfig {
  color?: string;
  canDragIn?: boolean;
  canDragOut?: boolean;
  canCreate?: boolean;
  actions?: KanbanRendererColumnAction[];
}

export interface KanbanRendererQueryResult {
  rows: KanbanRendererRow[];
  attributes?: KanbanRendererAttributeDescriptor[];
  boardColumnConfigs?: Record<string, KanbanRendererBoardColumnConfig>;
}

export interface KanbanRendererCreateRowContribution<TParams extends ParamObjectSchema = ParamObjectSchema> {
  command: CommandRef<Struct, unknown> | string;
  title?: Localizable<string>;
  submitLabel?: Localizable<string>;
  columnParam?: string;
  params?: TParams;
  /**
   * Pass the resource's editable attribute values to the create command as one
   * structured parameter, keyed by attribute id. The command destructures it.
   */
  attributesParam?: string;
  /** Upload selected files after creation, then invoke this command once per uploaded file. */
  attachments?: {
    command: CommandRef<Struct, unknown> | string;
    resourceParam: string;
    fileParam: string;
  };
  /** Dialog chrome copy. Defaults are English; supply l10n() values to translate. */
  labels?: {
    cancel?: Localizable<string>;
    properties?: Localizable<string>;
    submitError?: Localizable<string>;
    removeFile?: Localizable<string>;
  };
}

export interface KanbanRendererRowAction<TParams extends Struct = Struct> {
  id: string;
  label: Localizable<string>;
  icon?: string;
  /** Invoked with `{ rowId }` when the row's context-menu action is chosen. */
  command: CommandRef<TParams, unknown> | string;
  destructive?: boolean;
}

export type KanbanRendererRowActivationHandler = RendererCallback<
  { row: KanbanRendererRow },
  undefined | ExtensionNavigationTarget
>;

export interface KanbanRendererContribution extends RendererContributionBase {
  attributes?: KanbanRendererAttributeDescriptor[];
  query: RendererCallback<KanbanRendererQueryParams, KanbanRendererQueryResult>;
  onAttributeChange?: RendererCallback<{ rowId: string; attributeId: string; value: unknown }, unknown>;
  onReorder?: RendererCallback<{ rowId: string; beforeRowId?: string }, unknown>;
  onColumnAction?: RendererCallback<{ columnId: string; actionId: string }, unknown>;
  createRow?: KanbanRendererCreateRowContribution;
  rowActions?: KanbanRendererRowAction[];
  onRowActivate?: KanbanRendererRowActivationHandler;
  defaultSettings?: Partial<KanbanRendererSettings>;
  defaultFilters?: KanbanRendererFilterState;
  defaultViews?: KanbanRendererSavedView[];
  defaultActiveViewId?: string;
  hideToolbar?: boolean;
}

/**
 * Command palette resource providers contribute dynamic, searchable palette results
 * (e.g. slides in a presentation) backed by an extension `queryCommand`, instead of
 * static command entries generated at module load. The host queries matching providers
 * as the user types and refreshes results when a declared `refreshEvent` fires.
 */
export interface CommandPaletteResourceQueryParams {
  projectId?: string;
  modeId?: string;
  activeResource?: ResourceRef;
  providerId: string;
  query: string;
  limit: number;
}

export type CommandPaletteResourceTarget = ExtensionNavigationTarget;

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

export interface CommandPaletteResourceContribution {
  title: Localizable<string>;
  resourceKind?: string;
  queryCommand:
    | CommandRef<CommandPaletteResourceQueryParams, CommandPaletteResourceQueryResult>
    | `${string}.${string}`;
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

export interface ArtifactMountContribution {
  /** Relative path under .pstdio/<extension.name>/. */
  path: string;
  label: Localizable<string>;
  repoRole?: "default" | "selected" | "workspace";
}

export interface TemplateTypeContribution {
  label: Localizable<string>;
  description?: Localizable<string>;
}

export interface TemplateContribution {
  title: Localizable<string>;
  type: string;
  source: PackageAssetDescriptor;
  description?: Localizable<string>;
}

export interface SkillContribution {
  title: Localizable<string>;
  source: PackageAssetDescriptor;
  description?: Localizable<string>;
}

export type ThemeMode = "light" | "dark";

export interface ThemeContribution {
  title: Localizable<string>;
  source: PackageAssetDescriptor;
  format: "vscode-color-theme";
  mode?: ThemeMode;
  description?: Localizable<string>;
}

export interface FileIconThemeContribution {
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

export interface KeybindingContribution<TParams extends Struct = Struct> {
  /** Default chord. Used on every platform unless an override is provided. */
  key: KeybindingChord;
  /** macOS override. */
  mac?: KeybindingChord;
  /** Linux override. */
  linux?: KeybindingChord;
  /** Windows override. */
  win?: KeybindingChord;
  /** Command this chord executes. */
  command: CommandRef<TParams, unknown> | string;
  /** Optional command params. */
  args?: Partial<TParams>;
  /** Optional gating predicate. The host evaluates it at dispatch time. */
  when?: WhenExpression;
}
