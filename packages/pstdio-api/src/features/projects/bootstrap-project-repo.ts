import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { scaffoldBundledDocs } from "./scaffold-bundled-docs";
import { scaffoldBundledHooks } from "./scaffold-bundled-hooks";

export const bootstrapProjectRepo = async (repoPath: string, projectId: string) => {
  const pstdioPath = join(repoPath, ".pstdio");
  await mkdir(pstdioPath, { recursive: true });
  await writeFile(join(pstdioPath, "config.json"), `${JSON.stringify({ project_id: projectId }, null, 2)}\n`);
  await scaffoldBundledDocs(repoPath);
  await scaffoldBundledHooks(repoPath);
};
