import { existsSync, rmSync } from "node:fs";
import { basename, join } from "node:path";
import { readConfig, writeConfig } from "@/features/config/config";
import { scaffoldDocs } from "@/features/docs/scaffold";
import { installDefaultSkills } from "@/features/skills/install-default-skills";
import { API_URL } from "../api-url";
import { getProject } from "./api/get-project";
import { registerRepo } from "./api/register-repo";

const DOCS_DIR = join(".pstdio", "docs");
const TICKETS_DIR = join(".pstdio", "tickets");

type LinkOptions = {
  homedir?: string;
};

export const linkProject = async (root: string, projectId: string, options?: LinkOptions) => {
  const existingConfig = readConfig(root);
  const project = await getProject(API_URL, projectId);
  if (!project) {
    throw new Error(`Project not found: ${projectId}`);
  }

  await registerRepo(API_URL, projectId, { name: basename(root), path: root });

  if (existingConfig?.project_id && existingConfig.project_id !== projectId) {
    rmSync(join(root, TICKETS_DIR), { recursive: true, force: true });
  }

  writeConfig(root, { project_id: projectId });

  if (!existsSync(join(root, DOCS_DIR))) {
    scaffoldDocs(root);
  }

  await installDefaultSkills(root, projectId, API_URL, options?.homedir);
  return project;
};
