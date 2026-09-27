import { afterAll } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const folders: string[] = [];
afterAll(() => {
  for (const folder of folders) rmSync(folder, { recursive: true, force: true });
});
export const folderProjectInput = <T extends { name?: unknown }>(input: T) => {
  const path = mkdtempSync(join(tmpdir(), "pstdio-project-input-"));
  folders.push(path);
  return { ...input, initial_workspace: { provider_id: "pstdio.root", params: { path } } };
};
