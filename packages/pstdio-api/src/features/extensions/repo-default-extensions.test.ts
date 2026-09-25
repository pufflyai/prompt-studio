import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { installRepoDefaultExtensions } from "./default-extensions";
import { writeExtension } from "./default-extensions-test-fixtures";

describe("installRepoDefaultExtensions", () => {
  test("materializes only repo-scoped defaults without overwriting existing folders", async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-repo-defaults-"));
    const source = join(root, "source-extension");
    const userSource = join(root, "user-extension");
    const repo = join(root, "repo");
    writeExtension(source, "source-extension", "repo");
    writeExtension(userSource, "user-extension", "user");

    try {
      const first = await installRepoDefaultExtensions({
        repoPath: repo,
        defaultExtensions: [
          { source, installName: "source-extension", skipInstall: true },
          { source: userSource, installName: "user-extension", skipInstall: true },
        ],
      });
      writeFileSync(join(repo, ".pstdio", "extensions", "source-extension", "custom.txt"), "custom");
      const second = await installRepoDefaultExtensions({
        repoPath: repo,
        defaultExtensions: [{ source, installName: "source-extension", skipInstall: true }],
      });

      expect(first).toMatchObject({ materialized: ["source-extension"], skipped: [] });
      await second.rollback();
      expect(readFileSync(join(repo, ".pstdio", "extensions", "source-extension", "custom.txt"), "utf8")).toBe(
        "custom",
      );
      expect(second).toMatchObject({ materialized: [], skipped: ["source-extension"] });
      expect(existsSync(join(repo, ".pstdio", "extensions", "user-extension", "extension.ts"))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

test("a failed default installation batch removes only the defaults it created", async () => {
  const root = mkdtempSync(join(tmpdir(), "pstdio-default-batch-"));
  const repo = join(root, "repo");
  const source = join(root, "source");
  const existing = join(repo, ".pstdio", "extensions", "existing");
  writeExtension(source, "source", "repo");
  writeExtension(existing, "existing", "repo");
  writeFileSync(join(existing, "custom.txt"), "keep");
  try {
    await expect(
      installRepoDefaultExtensions({
        repoPath: repo,
        defaultExtensions: [
          { source, installName: "existing", skipInstall: true },
          { source, installName: "created", skipInstall: true },
          { source, installName: "../invalid", skipInstall: true },
        ],
      }),
    ).rejects.toThrow();
    expect(existsSync(join(repo, ".pstdio", "extensions", "created"))).toBe(false);
    expect(readFileSync(join(existing, "custom.txt"), "utf8")).toBe("keep");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
