import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

export const ensureProjectRepoScaffolding = async () => {};

export const bootstrapProjectRepo = async (repoPath: string, projectId: string, _filesRoot: string) => {
  const pstdioPath = join(repoPath, ".pstdio");
  await mkdir(pstdioPath, { recursive: true });
  await writeFile(join(pstdioPath, "config.json"), `${JSON.stringify({ project_id: projectId }, null, 2)}\n`);
  await ensureProjectRepoScaffolding();
};
