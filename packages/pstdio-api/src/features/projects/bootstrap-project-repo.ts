import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { scaffoldBundledPlugins } from "./scaffold-bundled-plugins";

const debugStep = async <T>(label: string, fn: () => Promise<T> | T): Promise<T> => {
  const start = Date.now();
  console.error(`[CI-DEBUG]   >>> ${label}`);
  try {
    const result = await fn();
    console.error(`[CI-DEBUG]   <<< ${label} OK ${Date.now() - start}ms`);
    return result;
  } catch (error) {
    console.error(`[CI-DEBUG]   <<< ${label} THROW ${Date.now() - start}ms ${(error as Error)?.message}`);
    throw error;
  }
};

export const ensureProjectRepoScaffolding = async (repoPath: string, filesRoot: string) => {
  await debugStep(`scaffoldBundledPlugins repoPath=${repoPath} src=${join(filesRoot, "plugins", "pstdio")}`, () =>
    scaffoldBundledPlugins(repoPath, join(filesRoot, "plugins", "pstdio")),
  );
};

export const bootstrapProjectRepo = async (repoPath: string, projectId: string, filesRoot: string) => {
  const pstdioPath = join(repoPath, ".pstdio");
  await debugStep(`mkdir ${pstdioPath}`, () => mkdir(pstdioPath, { recursive: true }));
  await debugStep(`writeFile ${join(pstdioPath, "config.json")}`, () =>
    writeFile(join(pstdioPath, "config.json"), `${JSON.stringify({ project_id: projectId }, null, 2)}\n`),
  );
  await debugStep("ensureProjectRepoScaffolding", () => ensureProjectRepoScaffolding(repoPath, filesRoot));
};
