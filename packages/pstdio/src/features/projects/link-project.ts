import { basename } from "node:path";
import { getProject } from "./api/get-project";
import { registerRepo } from "./api/register-repo";

type LinkOptions = {
  homedir?: string;
};

export const linkProject = async (root: string, projectId: string, _options?: LinkOptions) => {
  const project = await getProject(projectId);
  if (!project) {
    throw new Error(`Project not found: ${projectId}`);
  }

  await registerRepo(projectId, { name: basename(root), path: root });
  return project;
};
