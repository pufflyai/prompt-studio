import { apiRequest } from "@/lib/api";

export type DocsSidebarItem = {
  text: string;
  link?: string;
  items?: DocsSidebarItem[];
};

export type DocsIndex = {
  sidebar: DocsSidebarItem[];
};

export type DocsContent = {
  link: string;
  path: string;
  content: string;
};

export const getDocsIndex = async (projectId?: string) => {
  const index = await apiRequest<DocsIndex | null>(projectId ? `/api/projects/${projectId}/docs` : "/api/docs", {
    allowNotFound: true,
  });

  return index ?? { sidebar: [] };
};

export const getDocsContent = (link: string, projectId?: string) =>
  apiRequest<DocsContent>(
    projectId
      ? `/api/projects/${projectId}/docs/content?link=${encodeURIComponent(link)}`
      : `/api/docs/content?link=${encodeURIComponent(link)}`,
  );
