import type { ProjectListItem } from "../types";

export const filterProjects = (projects: ProjectListItem[], query: string) => {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return projects;

  return projects.filter((project) => {
    if (project.name.toLowerCase().includes(normalized)) return true;
    if (project.repoPath?.toLowerCase().includes(normalized)) return true;
    return false;
  });
};
