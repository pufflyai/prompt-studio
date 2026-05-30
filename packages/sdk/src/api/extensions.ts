import type { DashboardExtensionMetadata } from "pstdio-api-contracts";
import type {
  DataRendererContribution,
  DocumentEditorContribution,
  ExtensionSettingProperty,
  ModeContribution,
  ModeLayoutContribution,
  TreeItemContribution,
} from "../extensions/types/contributions";

export type {
  CommandExecuteRequest,
  CommandExecuteResponse,
  ExtensionCommandRecord,
  ExtensionDiagnostic,
  ExtensionMenuContribution,
  ExtensionNavigationRecord,
  ExtensionRecord,
  ExtensionRouteRecord,
  ExtensionSettingsPanelRecord,
  ExtensionViewRecord,
  ListExtensionAppearanceResponse,
  ListExtensionCommandsResponse,
  ListProjectExtensionsResponse,
  ProjectExtensionInstance,
  UpdateInstalledExtensionTemplateInput,
  UpdateInstalledExtensionTemplateResponse,
} from "pstdio-api-contracts";

type ExtensionDataRendererCreateRowRecord = Omit<NonNullable<DataRendererContribution["createRow"]>, "command"> & {
  commandId: string;
};

export type ExtensionDataRendererRecord = Omit<
  DataRendererContribution,
  "queryCommand" | "updateAttributeCommand" | "reorderCommand" | "columnActionCommand" | "createRow"
> & {
  id: string;
  extensionId: string;
  queryCommandId: string;
  updateAttributeCommandId?: string;
  reorderCommandId?: string;
  columnActionCommandId?: string;
  createRow?: ExtensionDataRendererCreateRowRecord;
};

export type ExtensionDocumentEditorRecord = Omit<DocumentEditorContribution, "readCommand" | "updateCommand"> & {
  id: string;
  extensionId: string;
  readCommandId: string;
  updateCommandId?: string;
};

export type ExtensionSettingDefinitionRecord = {
  key: string;
  extensionId: string;
} & ExtensionSettingProperty;

export type ExtensionSettingValueRecord = ExtensionSettingDefinitionRecord & {
  value?: unknown;
  source: "stored" | "default";
};

export type ExtensionTreeItemContribution = Omit<TreeItemContribution, "action"> & {
  id: string;
  extensionId: string;
  action:
    | {
        kind: "command";
        commandId: string;
        args?: Record<string, unknown>;
      }
    | { kind: "dataRenderer"; dataRendererId: string }
    | { kind: "route"; route: string }
    | { kind: "href"; href: string };
};

export type ModeLayoutContributionRecord = ModeLayoutContribution;

export type ExtensionModeRecord = Omit<ModeContribution, "id"> & {
  id: string;
  extensionId: string;
  modeId: string;
};

export type ListExtensionSettingsResponse = {
  settings: ExtensionSettingValueRecord[];
};

export type UpdateExtensionSettingRequest = {
  value: unknown;
};

export type WorkbenchExtensionDataRendererRecord = ExtensionDataRendererRecord;
export type WorkbenchExtensionDocumentEditorRecord = ExtensionDocumentEditorRecord;

export type WorkbenchExtensionMetadata = DashboardExtensionMetadata & {
  modes?: ExtensionModeRecord[];
  treeItems?: ExtensionTreeItemContribution[];
  dataRenderers?: WorkbenchExtensionDataRendererRecord[];
  documentEditors?: WorkbenchExtensionDocumentEditorRecord[];
  settingsDefinitions?: ExtensionSettingDefinitionRecord[];
};
