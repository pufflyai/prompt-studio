import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { decorateIgnoredWorkspaceFiles } from "./workspace-file-git-status";

test("a cancelled plain-folder file read rejects before returning decorations", async () => {
  const root = await mkdtemp(join(tmpdir(), "pstdio-plain-files-cancel-"));
  const reason = new Error("File read cancelled");
  try {
    await expect(
      decorateIgnoredWorkspaceFiles(
        root,
        [{ path: "memory.ts", name: "memory.ts", type: "file" }],
        AbortSignal.abort(reason),
      ),
    ).rejects.toBe(reason);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
