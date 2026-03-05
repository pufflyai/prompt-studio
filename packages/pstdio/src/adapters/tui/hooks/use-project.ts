import { useLiveQuery } from "@tanstack/react-db";
import { useState } from "react";

import { findGitRoot, readConfig, writeConfig } from "@/features/config/config";
import { getCollection } from "@/features/sync/collections";

type Project = {
  id: string;
  name: string;
};

export function useProject() {
  const root = findGitRoot(process.cwd());
  const config = root ? readConfig(root) : null;
  const [selectedId, setSelectedId] = useState<string | null>(config?.project_id ?? null);

  const { data: rawProjects } = useLiveQuery(() => getCollection("projects"));

  const projects: Project[] = (rawProjects ?? [])
    .filter((p) => !p.deleted_at)
    .map((p) => ({ id: p.id, name: p.name as string }));

  const project = projects.find((p) => p.id === selectedId) ?? null;

  const switchProject = (id: string) => {
    if (root) writeConfig(root, { project_id: id });
    setSelectedId(id);
  };

  return { project, projects, error: "", loadProjects: () => {}, switchProject };
}
