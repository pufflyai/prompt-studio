import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const folderProjectInput = <T extends object>(
  input: T,
  path = mkdtempSync(join(tmpdir(), "pstdio-project-")),
) => ({
  ...input,
  initial_workspace: { provider_id: "pstdio.root", params: { path } },
});
