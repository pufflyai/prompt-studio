import { basename } from "node:path";
import { readConfig, writeConfig } from "@/features/config/config";
import { scaffoldDocs } from "@/features/docs/scaffold";
import { scaffoldPlugins } from "@/features/hooks/scaffold";
import { installDefaultSkills } from "@/features/skills/install-default-skills";
import { createProject } from "./api/create-project";
import { registerRepo } from "./api/register-repo";

type InitOptions = {
  homedir?: string;
  repoPaths?: string[];
};

export const createAndInitProject = async (root: string, name: string, options?: InitOptions) => {
  if (readConfig(root)) {
    throw new Error("Project already initialized. Use `pstdio projects link` to switch projects.");
  }

  const project = await createProject(name);
  const repoPaths = options?.repoPaths ?? [];

  for (const repoPath of repoPaths) {
    await registerRepo(project.id, { name: basename(repoPath), path: repoPath });
  }

  if (repoPaths.includes(root)) return project;

  writeConfig(root, { project_id: project.id });
  await scaffoldDocs(root);
  await scaffoldPlugins(root);
  await installDefaultSkills(root, project.id, undefined, options?.homedir);
  return project;
};
