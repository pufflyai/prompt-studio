import type {
  ExtensionCommandRecord,
  ExtensionDiagnostic,
  ExtensionMenuContribution,
  ExtensionNavigationRecord,
  ExtensionRecord,
  ExtensionRouteRecord,
  ExtensionSettingsPanelRecord,
  ExtensionViewRecord,
} from "pstdio-api-contracts";

export type DashboardExtensionMetadata = {
  commands: ExtensionCommandRecord[];
  diagnostics: ExtensionDiagnostic[];
  extensions: ExtensionRecord[];
  menuContributions: ExtensionMenuContribution[];
  navigation: ExtensionNavigationRecord[];
  routes: ExtensionRouteRecord[];
  settingsPanels: ExtensionSettingsPanelRecord[];
  views: ExtensionViewRecord[];
};

export type ExtensionSlotKind = "menu" | "navigation" | "view" | "settings" | "renderer";

export type ExtensionRepoContext = {
  projectId: string;
  repoId: string;
  path: string;
  remote?: string | null;
  role?: "default" | "selected" | "workspace";
};

export type ExtensionResourceContext = {
  type: string;
  id: string;
  projectId?: string;
  label?: string;
  extensionId?: string;
  metadata?: Record<string, unknown>;
};
