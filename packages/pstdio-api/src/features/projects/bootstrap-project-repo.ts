import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { scaffoldBundledPlugins } from "./scaffold-bundled-plugins";

export const ensureProjectRepoScaffolding = async (repoPath: string, filesRoot: string) => {
  await scaffoldBundledPlugins(repoPath, join(filesRoot, "plugins", "pstdio"));
};

export const bootstrapProjectRepo = async (repoPath: string, projectId: string, filesRoot: string) => {
  const pstdioPath = join(repoPath, ".pstdio");
  await mkdir(pstdioPath, { recursive: true });
  await writeFile(join(pstdioPath, "config.json"), `${JSON.stringify({ project_id: projectId }, null, 2)}\n`);
  await ensureProjectRepoScaffolding(repoPath, filesRoot);
};
