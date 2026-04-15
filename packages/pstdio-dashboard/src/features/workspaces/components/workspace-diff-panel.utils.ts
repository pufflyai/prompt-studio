import type { ApiWorkspaceArtifact } from "@/features/ticket-list/data/api/types";

export type WorkspacePanelTab = "checks" | "changes";

interface ResolveWorkspacePanelTabInput {
  hasDiffs: boolean;
  hasUserSelectedTab: boolean;
  activeTab: WorkspacePanelTab;
}

export const resolveWorkspacePanelTab = (input: ResolveWorkspacePanelTabInput): WorkspacePanelTab => {
  const { hasDiffs, hasUserSelectedTab, activeTab } = input;

  if (hasUserSelectedTab) {
    return activeTab;
  }

  return hasDiffs ? "changes" : "checks";
};

export const resolveArtifactLabel = (relativePath: string) => {
  const segments = relativePath.split("/");
  const fileName = segments.at(-1) ?? relativePath;
  const directory = segments.length > 1 ? `${segments.slice(0, -1).join("/")}/` : "";

  const extensionStart = fileName.startsWith(".") ? fileName.indexOf(".", 1) : fileName.lastIndexOf(".");
  const baseName = extensionStart > 0 ? fileName.slice(0, extensionStart) : fileName;

  return `${directory}${baseName}`;
};

export const resolveSelectedArtifactFileId = (
  artifacts: ApiWorkspaceArtifact[],
  selectedArtifactFileId: string | null,
) => {
  if (artifacts.length === 0) return null;

  if (selectedArtifactFileId && artifacts.some((artifact) => artifact.file_id === selectedArtifactFileId)) {
    return selectedArtifactFileId;
  }

  return artifacts[0]?.file_id ?? null;
};
