import type { WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import type { WorkbenchAttachmentTarget } from "@pstdio/sdk/extensions";

export type DashboardExtensionMetadata = WorkbenchExtensionMetadata;

export type ExtensionSlotKind = "menu" | "panel" | "settings" | "renderer" | "kanbanRenderer";

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

export type ExtensionAttachmentContext = {
  target: WorkbenchAttachmentTarget;
  mode?: string;
  projectId?: string;
  resource?: ExtensionResourceContext;
};
