import type { Localizable } from "../l10n";
import type {
  WorkbenchMenuTarget,
  WorkbenchModeLayoutTarget,
  WorkbenchSettingsScope,
  WorkbenchSettingsTarget,
  WorkbenchTreeTarget,
  WorkbenchViewTarget,
} from "../workbench-targets";
import type { CommandRef, CommandSource } from "./commands";
import type { EventRef } from "./events";
import type { JsonObject, JsonValue, Struct } from "./json";
import type { ParamObjectSchema } from "./params";
import type { PackageAssetDescriptor, ResourceRef } from "./resources";
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

export interface TreeItemContribution<TParams extends Struct = Struct> {
  target: WorkbenchTreeTarget;
  label: Localizable<string>;
  group?: string;
  placement?: "first" | "default" | "last";
  icon?: string;
  when?: WhenExpression;
  action:
    | {
        kind: "command";
        command: CommandRef<TParams, unknown> | string;
        params?: Partial<TParams>;
      }
    | { kind: "dataRenderer"; dataRenderer: string }
    | { kind: "route"; route: string }
    | { kind: "href"; href: string };
}

export type WorkbenchLayoutTarget = WorkbenchModeLayoutTarget;

export type ModeTargetContribution =
  | {
      target: WorkbenchLayoutTarget;
      view: string;
      title?: Localizable<string>;
      resource?: string;
      pinned?: boolean;
    }
  | {
      target: WorkbenchLayoutTarget;
      resource: string;
      widget?: string;
      title?: Localizable<string>;
      pinned?: boolean;
    };

export interface ModeLayoutContribution {
  reset?: boolean | WorkbenchLayoutTarget[];
  open?: ModeTargetContribution[];
}

export interface ModeContribution {
  id?: string;
  label: Localizable<string>;
  icon?: string;
  resourceKind?: string;
  layout?: ModeLayoutContribution;
}

export interface WebviewContribution {
  entry: PackageAssetDescriptor;
  title?: Localizable<string>;
  capabilities?: WebviewCapabilityDeclaration[];
}

export type HostTreeDefault = "default" | "none";

export interface ViewContributionBase<TSlotContext extends Struct = Struct> {
  title: Localizable<string>;
  target?: WorkbenchViewTarget;
  slot?: SlotRef<TSlotContext, "view"> | string;
  group?: string;
  placement?: "first" | "default" | "last";
  /**
   * Marks this view as the editor for resources of the given kind. The host opens
   * the view's webview as a widget (bound to the resource) whenever a resource of
   * this kind is opened — e.g. a `ticket` data-renderer row opening the editor.
   */
  resourceKind?: string;
  /**
   * Where the host mounts the view. `panel` (default) docks it in a workbench area;
   * `modal` mounts it as an overlay dialog — used by data-renderer create flows where
   * a row's create button opens the matching `resourceKind` modal instead of the
   * inline create command.
   */
  surface?: "panel" | "modal";
  /** Opts tree-backed views into host-owned default header rows such as dashboard Search. */
  hostTreeHeader?: HostTreeDefault;
  /** Opts tree-backed views into host-owned default footer rows such as dashboard Settings. */
  hostTreeFooter?: HostTreeDefault;
}

export type ViewContribution<TSlotContext extends Struct = Struct> = ViewContributionBase<TSlotContext> &
  (
    | {
        webview: WebviewContribution;
        treeRenderer?: never;
        fileRenderer?: never;
      }
    | {
        treeRenderer: string;
        webview?: never;
        fileRenderer?: never;
      }
    | {
        fileRenderer: string;
        webview?: never;
        treeRenderer?: never;
      }
  );

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
  webview: WebviewContribution;
}

export type DataRendererViewMode = "board" | "list";
export type DataRendererSortDirection = "asc" | "desc";

export interface DataRendererEnumOption {
  value: string;
  label: Localizable<string>;
  color?: string;
  icon?: string | null;
}

export type DataRendererAttributeType =
  | { kind: "enum"; options: DataRendererEnumOption[] }
  | { kind: "enum-multi"; options: DataRendererEnumOption[] }
  | { kind: "string" }
  | { kind: "date" }
  | { kind: "number" }
  | { kind: "user" };

export type DataRendererAttributeDisplay = { kind: "workspace-badge"; itemsAttributeId: string };

export interface DataRendererAttributeDescriptor {
  id: string;
  label: Localizable<string>;
  type: DataRendererAttributeType;
  filterable?: boolean;
  groupable?: boolean;
  sortable?: boolean;
  displayable?: boolean;
  editable?: boolean;
  display?: DataRendererAttributeDisplay;
}

export interface DataRendererSettings {
  viewMode: DataRendererViewMode;
  columnGrouping: string;
  rowGrouping: string;
  ordering: {
    attributeId: string;
    direction: DataRendererSortDirection;
  };
  displayProperties: string[];
}

export type DataRendererFilterState = Record<string, string[]>;

export interface DataRendererQueryParams {
  settings: DataRendererSettings;
  filters: DataRendererFilterState;
}

export interface DataRendererResourceRef {
  type: string;
  id: string;
  projectId?: string;
  label?: string;
  extensionId?: string;
  metadata?: JsonObject;
}

export interface DataRendererRow {
  id: string;
  title: string;
  resource?: DataRendererResourceRef;
  attributes: Record<string, unknown>;
}

export interface DataRendererColumnAction {
  id: string;
  label: Localizable<string>;
  icon?: string;
}

export interface DataRendererBoardColumnConfig {
  color?: string;
  canDragIn?: boolean;
  canDragOut?: boolean;
  canCreate?: boolean;
  actions?: DataRendererColumnAction[];
}

export interface DataRendererQueryResult {
  rows: DataRendererRow[];
  attributes?: DataRendererAttributeDescriptor[];
  boardColumnConfigs?: Record<string, DataRendererBoardColumnConfig>;
}

export interface DataRendererCreateRowContribution<TParams extends ParamObjectSchema = ParamObjectSchema> {
  command: CommandRef<Struct, unknown> | string;
  title?: Localizable<string>;
  submitLabel?: Localizable<string>;
  columnParam?: string;
  params?: TParams;
}

export interface DataRendererSavedViewsContribution {
  resourceKind: string;
  scope?: "project" | "user";
}

export interface DataRendererRowAction<TParams extends Struct = Struct> {
  id: string;
  label: Localizable<string>;
  icon?: string;
  /** Invoked with `{ rowId }` when the row's context-menu action is chosen. */
  command: CommandRef<TParams, unknown> | string;
  destructive?: boolean;
}

export interface DataRendererContribution {
  title: Localizable<string>;
  resourceKind?: string;
  attributes?: DataRendererAttributeDescriptor[];
  queryCommand: CommandRef<DataRendererQueryParams, DataRendererQueryResult> | string;
  updateAttributeCommand?: CommandRef<{ rowId: string; attributeId: string; value: unknown }, unknown> | string;
  reorderCommand?: CommandRef<{ rowId: string; beforeRowId?: string }, unknown> | string;
  columnActionCommand?: CommandRef<{ columnId: string; actionId: string }, unknown> | string;
  createRow?: DataRendererCreateRowContribution;
  rowActions?: DataRendererRowAction[];
  defaultSettings?: Partial<DataRendererSettings>;
  defaultFilters?: DataRendererFilterState;
  emptyTitle?: Localizable<string>;
  emptyDescription?: Localizable<string>;
  hideToolbar?: boolean;
  savedViews?: DataRendererSavedViewsContribution;
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

export type CommandPaletteResourceTarget =
  | { kind: "command"; command: CommandRef<Struct, unknown> | string; params?: Struct }
  | { kind: "resource"; resource: ResourceRef };

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
  queryCommand: CommandRef<CommandPaletteResourceQueryParams, CommandPaletteResourceQueryResult> | string;
  refreshEvents?: (EventRef | string)[];
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

export interface RendererContribution<TSlotContext extends Struct = Struct> {
  slot: SlotRef<TSlotContext, "renderer"> | string;
  for: string;
  webview: WebviewContribution;
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
