import { apiRequest } from "@/lib/api";

export type DocsSidebarItem = {
  text: string;
  link?: string;
  items?: DocsSidebarItem[];
};

export type DocsIndex = {
  sidebar: DocsSidebarItem[];
  missingLinks: string[];
};

export type DocsContent = {
  link: string;
  path: string;
  content: string;
};

export const getDocsIndex = async (projectId?: string) => {
  if (!projectId) {
    return { sidebar: [], missingLinks: [] };
  }

  const index = await apiRequest<DocsIndex | null>(`/v1/projects/${projectId}/docs`, {
    allowNotFound: true,
  });

  return index ?? { sidebar: [], missingLinks: [] };
};

export const getDocsContent = (link: string, projectId?: string) => {
  if (!projectId) {
    throw new Error("projectId is required to fetch docs content");
  }

  return apiRequest<DocsContent>(`/v1/projects/${projectId}/docs/content?link=${encodeURIComponent(link)}`);
};
