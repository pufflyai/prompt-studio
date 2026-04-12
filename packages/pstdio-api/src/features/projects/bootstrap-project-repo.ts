import { existsSync, lstatSync, readdirSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
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

  try {
    const parent = dirname(pstdioPath);
    console.error(
      `[CI-DEBUG]   probe parent=${parent} parentExists=${existsSync(parent)} pstdioExists=${existsSync(pstdioPath)}`,
    );
    if (existsSync(pstdioPath)) {
      const lst = lstatSync(pstdioPath);
      console.error(
        `[CI-DEBUG]   probe pstdio isDir=${lst.isDirectory()} isSymlink=${lst.isSymbolicLink()} mode=${lst.mode.toString(8)}`,
      );
    }
    if (existsSync(parent)) {
      const entries = readdirSync(parent).slice(0, 10);
      console.error(`[CI-DEBUG]   probe parentEntries=${JSON.stringify(entries)}`);
    }
  } catch (probeErr) {
    console.error(`[CI-DEBUG]   probe THROW ${(probeErr as Error)?.message}`);
  }

  await debugStep(`mkdir-spawn ${pstdioPath}`, async () => {
    const proc = Bun.spawn(["mkdir", "-p", pstdioPath], { stderr: "pipe", stdout: "pipe" });
    const exitCode = await proc.exited;
    console.error(`[CI-DEBUG]   mkdir-spawn exitCode=${exitCode}`);
  });
  await debugStep(`mkdir-fs ${pstdioPath}`, () => mkdir(pstdioPath, { recursive: true }));
  await debugStep(`writeFile ${join(pstdioPath, "config.json")}`, () =>
    writeFile(join(pstdioPath, "config.json"), `${JSON.stringify({ project_id: projectId }, null, 2)}\n`),
  );
  await debugStep("ensureProjectRepoScaffolding", () => ensureProjectRepoScaffolding(repoPath, filesRoot));
};
