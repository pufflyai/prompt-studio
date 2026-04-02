import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { scaffoldHooks } from "./scaffold";

let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "pstdio-scaffold-hooks-"));
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

describe("scaffoldHooks", () => {
  test("repairs a stale compiled-runtime extraction before copying hooks", async () => {
    const extractedRoot = join(tmpdir(), "pstdio-files");
    const runtime = Bun as unknown as { embeddedFiles?: (Blob & { name: string })[] };
    const originalEmbeddedFiles = runtime.embeddedFiles;

    const makeEmbeddedFile = (name: string, content: string) =>
      Object.assign(new Blob([content], { type: "text/plain" }), { name });

    rmSync(extractedRoot, { recursive: true, force: true });
    const { mkdirSync, writeFileSync } = await import("node:fs");
    mkdirSync(join(extractedRoot, "documentation"), { recursive: true });
    mkdirSync(join(extractedRoot, "hooks"), { recursive: true });
    mkdirSync(join(extractedRoot, "templates", "prompts"), { recursive: true });
    writeFileSync(join(extractedRoot, "documentation", "index.md"), "stale docs");
    writeFileSync(join(extractedRoot, "hooks", "post-worktree-create."), "#!/bin/sh\necho stale\n");
    writeFileSync(join(extractedRoot, "hooks", "pre-attempt-status-review-ready."), "#!/bin/sh\necho stale\n");
    writeFileSync(join(extractedRoot, "templates", "prompts", "review-me.txt"), "stale prompt");

    runtime.embeddedFiles = [
      makeEmbeddedFile("../files/documentation/index.md", "# docs"),
      makeEmbeddedFile("../files/hooks/post-worktree-create.", "#!/bin/sh\necho ok\n"),
      makeEmbeddedFile("../files/hooks/pre-attempt-status-review-ready.", "#!/bin/sh\necho ok\n"),
      makeEmbeddedFile("../files/templates/prompts/review-me.txt", "review me"),
    ];

    try {
      await scaffoldHooks(tempDir);

      expect(existsSync(join(tempDir, ".pstdio", "hooks", "post-worktree-create"))).toBe(true);
      expect(existsSync(join(tempDir, ".pstdio", "hooks", "pre-attempt-status-review-ready"))).toBe(true);
      expect(existsSync(join(tempDir, ".pstdio", "hooks", "post-worktree-create."))).toBe(false);
      expect(existsSync(join(tempDir, ".pstdio", "hooks", "pre-attempt-status-review-ready."))).toBe(false);
    } finally {
      runtime.embeddedFiles = originalEmbeddedFiles;
      rmSync(extractedRoot, { recursive: true, force: true });
    }
  });

  test("writes default hooks into .pstdio/hooks", async () => {
    await scaffoldHooks(tempDir);

    const postCreatePath = join(tempDir, ".pstdio", "hooks", "post-worktree-create");
    expect(existsSync(postCreatePath)).toBe(true);

    const postCreateContent = readFileSync(postCreatePath, "utf8");
    expect(postCreateContent).toContain("pstdio tickets pull");
    expect(postCreateContent).toContain("config.json");

    const preReviewReadyPath = join(tempDir, ".pstdio", "hooks", "pre-attempt-status-review-ready");
    expect(existsSync(preReviewReadyPath)).toBe(true);

    const preReviewReadyContent = readFileSync(preReviewReadyPath, "utf8");
    expect(preReviewReadyContent).toContain("validate");
  });

  test("does not overwrite existing hooks directory", async () => {
    const { mkdirSync, writeFileSync } = await import("node:fs");
    const hooksDir = join(tempDir, ".pstdio", "hooks");
    mkdirSync(hooksDir, { recursive: true });
    writeFileSync(join(hooksDir, "post-worktree-create"), "custom script");

    await scaffoldHooks(tempDir);

    const content = readFileSync(join(hooksDir, "post-worktree-create"), "utf8");
    expect(content).toBe("custom script");
  });
});
