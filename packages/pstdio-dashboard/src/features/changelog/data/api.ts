import type { DocsChangelogEntry } from "@pstdio/ui";
import { apiRequest } from "@/lib/api";

export type Changelog = {
  title: string;
  description?: string;
  entries: DocsChangelogEntry[];
};

export const getChangelog = async (projectId?: string) => {
  if (!projectId) {
    return { title: "Changelog", entries: [] };
  }

  const changelog = await apiRequest<Changelog | null>(`/v1/projects/${projectId}/changelog`, {
    allowNotFound: true,
  });

  return changelog ?? { title: "Changelog", entries: [] };
};
