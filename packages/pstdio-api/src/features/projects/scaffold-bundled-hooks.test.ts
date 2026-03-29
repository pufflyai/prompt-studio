import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { scaffoldBundledHooks } from "./scaffold-bundled-hooks";

let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "pstdio-api-scaffold-hooks-"));
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

describe("scaffoldBundledHooks", () => {
  test("writes embedded hooks when source hooks directory is unavailable", async () => {
    const runtime = Bun as unknown as { embeddedFiles?: (Blob & { name: string })[] };
    const originalEmbeddedFiles = runtime.embeddedFiles;
    const missingHooksDir = join(tempDir, "missing-hooks");

    const makeEmbeddedFile = (name: string, content: string) =>
      Object.assign(new Blob([content], { type: "text/plain" }), { name });

    runtime.embeddedFiles = [
      makeEmbeddedFile("../files/hooks/post-worktree-create.", "#!/bin/sh\necho ok\n"),
      makeEmbeddedFile("../files/hooks/post-session-success.", "#!/bin/sh\necho ok\n"),
    ];

    try {
      await scaffoldBundledHooks(tempDir, missingHooksDir);

      expect(existsSync(join(tempDir, ".pstdio", "hooks", "post-worktree-create"))).toBe(true);
      expect(existsSync(join(tempDir, ".pstdio", "hooks", "post-session-success"))).toBe(true);
      expect(existsSync(join(tempDir, ".pstdio", "hooks", "post-worktree-create."))).toBe(false);
      expect(existsSync(join(tempDir, ".pstdio", "hooks", "post-session-success."))).toBe(false);
    } finally {
      runtime.embeddedFiles = originalEmbeddedFiles;
    }
  });
});
