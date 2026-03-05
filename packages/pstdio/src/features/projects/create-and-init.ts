import { basename } from "node:path";
import { readConfig, writeConfig } from "@/features/config/config";
import { scaffoldDocs } from "@/features/docs/scaffold";
import { installDefaultSkills } from "@/features/skills/install-default-skills";
import { seedBundledTemplates } from "@/features/templates/seed-bundled-templates";
import { API_URL } from "../api-url";
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

  const project = await createProject(API_URL, name);

  for (const repoPath of options?.repoPaths ?? []) {
    await registerRepo(API_URL, project.id, { name: basename(repoPath), path: repoPath });
  }

  writeConfig(root, { project_id: project.id });
  scaffoldDocs(root);
  await seedBundledTemplates(API_URL, project.id);
  await installDefaultSkills(root, API_URL, options?.homedir);
  return project;
};
