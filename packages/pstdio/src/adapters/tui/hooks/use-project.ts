import { useEffect, useState } from "react";
import { API_URL } from "@/features/api-url";
import { findGitRoot, readConfig, writeConfig } from "@/features/config/config";
import { getProject } from "@/features/projects/api/get-project";
import { listProjects } from "@/features/projects/api/list-projects";

type Project = {
  id: string;
  name: string;
};

export function useProject() {
  const [project, setProject] = useState<Project | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const root = findGitRoot(process.cwd());
    if (!root) return;

    const config = readConfig(root);
    if (!config) return;

    getProject(API_URL, config.project_id)
      .then((p) => {
        if (p) setProject(p);
      })
      .catch(() => setError("Failed to load project"));
  }, []);

  const loadProjects = async () => {
    try {
      const all = await listProjects(API_URL);
      setProjects(all);
      setError("");
    } catch {
      setError("Failed to load projects");
    }
  };

  const switchProject = (id: string) => {
    const root = findGitRoot(process.cwd());
    if (!root) return;

    writeConfig(root, { project_id: id });

    const selected = projects.find((p) => p.id === id);
    if (selected) setProject(selected);
  };

  return { project, projects, error, loadProjects, switchProject };
}
