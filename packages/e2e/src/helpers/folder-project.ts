import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const generatedFolders = new Set<string>();
process.once("exit", () => {
  for (const path of generatedFolders) rmSync(path, { recursive: true, force: true });
});

const createProjectFolder = () => {
  const home = process.env.E2E_HOME;
  if (home) {
    // The API can still write skills after a browser worker exits. The launcher
    // owns this home and removes it only after Playwright has stopped its server.
    const folders = join(home, "project-folders");
    mkdirSync(folders, { recursive: true });
    return mkdtempSync(join(folders, "project-"));
  }
  const path = mkdtempSync(join(tmpdir(), "pstdio-project-"));
  generatedFolders.add(path);
  return path;
};

export const folderProjectInput = <T extends object>(input: T, path = createProjectFolder()) => ({
  ...input,
  initial_workspace: { provider_id: "pstdio.root", params: { path } },
});
