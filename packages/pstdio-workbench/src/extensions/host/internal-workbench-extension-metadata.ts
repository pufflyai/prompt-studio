import type { WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import type {
  ExtensionKeybindingRecord,
  ExtensionMenuContribution,
  ExtensionSettingDefinitionRecord,
  ExtensionSettingsSectionRecord,
  WorkbenchExtensionCommandPaletteResourceRecord,
  WorkbenchExtensionControlsRendererRecord,
  WorkbenchExtensionDataTableRendererRecord,
  WorkbenchExtensionFileRendererRecord,
  WorkbenchExtensionKanbanRendererRecord,
  WorkbenchExtensionTreeRendererRecord,
} from "pstdio-api-contracts";
import type {
  WorkbenchOwnedPlacementItem,
  WorkbenchPageContribution,
  WorkbenchPlacementPresentation,
} from "../../core";

type MetadataView = WorkbenchExtensionMetadata["views"][number];
type MetadataWebview = Extract<MetadataView["body"], { kind: "webview" }>["webview"];
type MetadataRendererKind = Exclude<MetadataView["body"]["kind"], "webview">;

interface InternalWorkbenchExtensionPanelMenu {
  id: string;
  extensionId: string;
  ownerPanelId: string;
  viewId: string;
  title: MetadataView["title"];
  side: "left" | "right";
  group?: string;
  placement?: "first" | "default" | "last";
  hostTreeHeader?: "default" | "none";
  hostTreeFooter?: "default" | "none";
  webview?: MetadataWebview;
  renderer?: { kind: MetadataRendererKind; id: string };
}

export interface InternalWorkbenchExtensionPanel {
  id: string;
  extensionId: string;
  title: MetadataView["title"];
  icon?: string;
  webview?: MetadataWebview;
  renderer?: { kind: MetadataRendererKind; id: string };
  panelMenus?: InternalWorkbenchExtensionPanelMenu[];
}

export interface InternalWorkbenchExtensionMetadata {
  extensions: WorkbenchExtensionMetadata["extensions"];
  commands: WorkbenchExtensionMetadata["commands"];
  menuContributions: ExtensionMenuContribution[];
  commandPaletteContributions: WorkbenchExtensionMetadata["commandPaletteContributions"];
  modes: Array<{
    id: string;
    extensionId: string;
    modeId: string;
    label: WorkbenchExtensionMetadata["modes"][number]["label"];
    icon?: string;
    defaultTheme?: string;
    chrome?: Partial<Record<"nav" | "sidenav" | "activity" | "status", string | false>>;
    panelRegions: WorkbenchExtensionMetadata["modes"][number]["regions"];
    regionSettings?: WorkbenchExtensionMetadata["modes"][number]["regionSettings"];
  }>;
  pages: WorkbenchPageContribution[];
  placements: Array<
    {
      id: string;
      ref: { extensionId: string; kind: "placement"; id: string };
      modeId: string;
      item: WorkbenchOwnedPlacementItem;
      region: "main" | "secondary" | "side";
      order?: number;
      movableTo?: readonly ("main" | "secondary" | "side")[];
    } & WorkbenchPlacementPresentation
  >;
  panels: InternalWorkbenchExtensionPanel[];
  resourceKinds: Array<{
    id: string;
    extensionId: string;
    label?: WorkbenchExtensionMetadata["resourceKinds"][number]["label"];
    icon?: string;
    menuSlots: Record<
      string,
      { placement: "header-primary" | "header-overflow" | "context-menu"; external: boolean; order?: number }
    >;
  }>;
  resourceHierarchyProviders: Array<{ id: string; extensionId: string; resourceKind: string }>;
  settingsSections: ExtensionSettingsSectionRecord[];
  settingsPanels: Array<{
    id: string;
    extensionId: string;
    viewId: string;
    slotId: string;
    scope: "global" | "project";
    title: MetadataView["title"];
    icon?: string;
    section?: string;
  }>;
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
