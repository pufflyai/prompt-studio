import { test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expectRejection } from "../../test-utils/expect-rejection";
import { decorateIgnoredWorkspaceFiles } from "./workspace-file-git-status";

test("a cancelled plain-folder file read rejects before returning decorations", async () => {
  const root = await mkdtemp(join(tmpdir(), "pstdio-plain-files-cancel-"));
  const reason = new Error("File read cancelled");
  try {
    await expectRejection(
      decorateIgnoredWorkspaceFiles(
        root,
        [{ path: "memory.ts", name: "memory.ts", type: "file" }],
        AbortSignal.abort(reason),
      ),
    ).toBe(reason);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
