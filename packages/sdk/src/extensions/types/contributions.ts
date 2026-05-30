import type {
  WorkbenchMenuTarget,
  WorkbenchModeLayoutTarget,
  WorkbenchSettingsScope,
  WorkbenchSettingsTarget,
  WorkbenchTreeTarget,
  WorkbenchViewTarget,
} from "../workbench-targets";
import type { CommandRef, CommandSource } from "./commands";
import type { JsonObject, JsonValue, Struct } from "./json";
import type { ParamObjectSchema } from "./params";
import type { PackageAssetDescriptor } from "./resources";
import type { SlotRef } from "./slots";
import type { WebviewCapabilityDeclaration } from "./webview-capabilities";

export interface CliContribution {
  path?: string[];
  globalAliases?: string[][];
  description?: string;
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
  label?: string;
  group?: string;
  placement?: "first" | "default" | "last";
  icon?: string;
  when?: WhenExpression;
  command?: CommandRef<TParams, unknown> | string;
  params?: Partial<TParams>;
  presentation?: "menu-item" | "button" | "icon-button";
}

/** @deprecated Legacy slot navigation. Use treeItems with workbench targets instead. */
export interface NavigationContribution<TSlotContext extends Struct = Struct, TParams extends Struct = Struct> {
  slot: SlotRef<TSlotContext, "navigation"> | string;
  label: string;
  group?: string;
  placement?: "first" | "default" | "last";
  route?: string;
  href?: string;
  command?: CommandRef<TParams, unknown> | string;
  params?: Partial<TParams>;
  icon?: string;
  when?: WhenExpression;
}

export interface TreeItemContribution<TParams extends Struct = Struct> {
  target: WorkbenchTreeTarget;
  label: string;
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
      title?: string;
      resource?: string;
      pinned?: boolean;
    }
  | {
      target: WorkbenchLayoutTarget;
      resource: string;
      widget?: string;
      title?: string;
      pinned?: boolean;
    };

export interface ModeLayoutContribution {
  reset?: boolean | WorkbenchLayoutTarget[];
  open?: ModeTargetContribution[];
}

export interface ModeContribution {
  id?: string;
  label: string;
  icon?: string;
  layout?: ModeLayoutContribution;
}

export interface WebviewContribution {
  entry: PackageAssetDescriptor;
  title?: string;
  capabilities?: WebviewCapabilityDeclaration[];
}

export interface ViewContribution<TSlotContext extends Struct = Struct> {
  title: string;
  target?: WorkbenchViewTarget;
  slot?: SlotRef<TSlotContext, "view"> | string;
  group?: string;
  placement?: "first" | "default" | "last";
  webview: WebviewContribution;
}

export interface RouteContribution {
  path: string;
  label: string;
  webview: WebviewContribution;
}

export interface SettingsPanelContribution<TSlotContext extends Struct = Struct> {
  title: string;
  target?: WorkbenchSettingsTarget;
  scope?: WorkbenchSettingsScope;
  slot?: SlotRef<TSlotContext, "settings"> | string;
  webview: WebviewContribution;
}

export type DataRendererViewMode = "board" | "list";
export type DataRendererSortDirection = "asc" | "desc";

export interface DataRendererEnumOption {
  value: string;
  label: string;
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

export interface DataRendererAttributeDescriptor {
  id: string;
  label: string;
  type: DataRendererAttributeType;
  filterable?: boolean;
  groupable?: boolean;
  sortable?: boolean;
  displayable?: boolean;
  editable?: boolean;
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
  label: string;
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
  title?: string;
  submitLabel?: string;
  columnParam?: string;
  params?: TParams;
}

export interface DataRendererSavedViewsContribution {
  resourceKind: string;
  scope?: "project" | "user";
}

export interface DataRendererContribution {
  title: string;
  resourceKind?: string;
  attributes?: DataRendererAttributeDescriptor[];
  queryCommand: CommandRef<DataRendererQueryParams, DataRendererQueryResult> | string;
  updateAttributeCommand?: CommandRef<{ rowId: string; attributeId: string; value: unknown }, unknown> | string;
  reorderCommand?: CommandRef<{ rowId: string; beforeRowId?: string }, unknown> | string;
  columnActionCommand?: CommandRef<{ columnId: string; actionId: string }, unknown> | string;
  createRow?: DataRendererCreateRowContribution;
  defaultSettings?: Partial<DataRendererSettings>;
  defaultFilters?: DataRendererFilterState;
  emptyTitle?: string;
  emptyDescription?: string;
  hideToolbar?: boolean;
  savedViews?: DataRendererSavedViewsContribution;
}

export interface DocumentEditorFile {
  id: string;
  name: string;
  content: string;
  language?: string;
  mimeType?: string;
  editable?: boolean;
}

export interface DocumentEditorProperty {
  id: string;
  label: string;
  value?: string | number | boolean | null;
}

export interface DocumentEditorReadResult {
  title?: string;
  activeFileId?: string;
  properties?: DocumentEditorProperty[];
  files: DocumentEditorFile[];
}

export type DocumentEditorPanelTarget = "workbench.main.left" | "workbench.main.right";

export interface DocumentEditorPanelLayout {
  target: DocumentEditorPanelTarget;
  title?: string;
}

export interface DocumentEditorLayout {
  autoSave?: boolean;
  header?: {
    visible?: boolean;
  };
  properties?: DocumentEditorPanelLayout;
  fileOverview?: DocumentEditorPanelLayout;
}

export interface DocumentEditorContribution {
  title: string;
  resourceKind: string;
  readCommand: CommandRef<Struct, DocumentEditorReadResult> | string;
  updateCommand?: CommandRef<{ fileId: string; content: string }, unknown> | string;
  layout?: DocumentEditorLayout;
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
    title?: string;
    description?: string;
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
  label: string;
  repoRole?: "default" | "selected" | "workspace";
}

export interface TemplateTypeContribution {
  label: string;
  description?: string;
}

export interface TemplateContribution {
  title: string;
  type: string;
  source: PackageAssetDescriptor;
  description?: string;
}

export interface SkillContribution {
  title: string;
  source: PackageAssetDescriptor;
  description?: string;
}

export type ThemeMode = "light" | "dark";

export interface ThemeContribution {
  title: string;
  source: PackageAssetDescriptor;
  format: "vscode-color-theme";
  mode?: ThemeMode;
  description?: string;
}

export interface FileIconThemeContribution {
  title: string;
  source: PackageAssetDescriptor;
  format: "vscode-file-icon-theme";
  description?: string;
}
