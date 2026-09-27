import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const generatedFolders = new Set<string>();
process.once("exit", () => {
  for (const path of generatedFolders) rmSync(path, { recursive: true, force: true });
});

const createProjectFolder = () => {
  const path = mkdtempSync(join(tmpdir(), "pstdio-project-"));
  generatedFolders.add(path);
  return path;
};

export const folderProjectInput = <T extends object>(input: T, path = createProjectFolder()) => ({
  ...input,
  initial_workspace: { provider_id: "pstdio.root", params: { path } },
});
