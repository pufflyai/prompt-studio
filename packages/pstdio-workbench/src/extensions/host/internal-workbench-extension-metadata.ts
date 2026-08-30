import type { WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import type {
  ExtensionActivityItemRecord,
  ExtensionKeybindingRecord,
  ExtensionMenuContribution,
  ExtensionModeRecord,
  ExtensionResourceKindRecord,
  ExtensionSettingDefinitionRecord,
  ExtensionSettingsSectionRecord,
  ExtensionTreeItemContribution,
  WorkbenchExtensionCommandPaletteResourceRecord,
  WorkbenchExtensionControlsRendererRecord,
  WorkbenchExtensionDataTableRendererRecord,
  WorkbenchExtensionFileRendererRecord,
  WorkbenchExtensionKanbanRendererRecord,
  WorkbenchExtensionPanelRecord,
  WorkbenchExtensionSettingsPanelRecord,
  WorkbenchExtensionTreeRendererRecord,
} from "pstdio-api-contracts";

export interface InternalWorkbenchExtensionMetadata {
  extensions: WorkbenchExtensionMetadata["extensions"];
  commands: WorkbenchExtensionMetadata["commands"];
  menuContributions: ExtensionMenuContribution[];
  commandPaletteContributions: WorkbenchExtensionMetadata["commandPaletteContributions"];
  modes: ExtensionModeRecord[];
  pages: WorkbenchExtensionMetadata["pages"];
  panels: WorkbenchExtensionPanelRecord[];
  resourceKinds: ExtensionResourceKindRecord[];
  resourceHierarchyProviders: Array<{ id: string; extensionId: string; resourceKind: string }>;
  routes: [];
  treeItems: ExtensionTreeItemContribution[];
  activityItems: ExtensionActivityItemRecord[];
  settingsSections: ExtensionSettingsSectionRecord[];
  settingsPanels: WorkbenchExtensionSettingsPanelRecord[];
  kanbanRenderers: WorkbenchExtensionKanbanRendererRecord[];
  dataTableRenderers: WorkbenchExtensionDataTableRendererRecord[];
  commandPaletteResources: WorkbenchExtensionCommandPaletteResourceRecord[];
  treeRenderers: WorkbenchExtensionTreeRendererRecord[];
  fileRenderers: WorkbenchExtensionFileRendererRecord[];
  controlsRenderers: WorkbenchExtensionControlsRendererRecord[];
  keybindings: ExtensionKeybindingRecord[];
  settingsDefinitions: ExtensionSettingDefinitionRecord[];
  statuses: WorkbenchExtensionMetadata["statuses"];
  statusBarItems: Array<{
    id: string;
    extensionId: string;
    viewId: string;
    slot: "leading" | "trailing";
    order?: number;
    when?: {
      mode?: string | string[];
      source?: string[];
      viewId?: string | string[];
      resourceType?: string[];
      metadata?: Record<string, unknown>;
    };
  }>;
  diagnostics: WorkbenchExtensionMetadata["diagnostics"];
}
