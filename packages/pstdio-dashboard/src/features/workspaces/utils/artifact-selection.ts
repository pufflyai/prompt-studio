import type { ApiWorkspaceArtifact } from "@/features/ticket-list/data/api/types";

export const resolveSelectedArtifact = (artifacts: ApiWorkspaceArtifact[], currentId: string | null): string | null => {
  if (artifacts.length === 0) return null;
  if (currentId && artifacts.some((a) => a.id === currentId)) return currentId;
  return artifacts[0].id;
};
