import type { WorkbenchExtensionMetadata as ApiDashboardExtensionMetadata } from "@pstdio/sdk/api";

export type DashboardExtensionMetadata = ApiDashboardExtensionMetadata;

export type ExtensionSlotKind = "menu" | "view" | "settings" | "renderer";

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
