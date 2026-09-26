import { describe, expect, mock, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { installRepoDefaultExtensions } from "./default-extensions";
import { writeExtension } from "./default-extensions-test-fixtures";

describe("installRepoDefaultExtensions", () => {
  test.each([undefined, "explicit-ref"])("resolves named repo defaults at the selected ref (%s)", async (ref) => {
    const root = mkdtempSync(join(tmpdir(), "repo-release-ref-"));
    const source = join(root, "source");
    writeExtension(source, "release-test", "repo");
    const prepareNamedSource = mock(async (_name: string, _tempDir: string, _ref?: string) => ({
      path: source,
      ref: "resolved-commit",
    }));
    const prepareSharedCheckout = mock(async () => ({ prepareNamedSource, cleanup: () => {} }));
    try {
      await installRepoDefaultExtensions({
        repoPath: join(root, "repo"),
        defaultExtensions: [{ source: "release-test", installName: "release-test", skipInstall: true, ref }],
        releaseRef: "pstdio@0.34.0",
        prepareSharedCheckout,
      });
      expect(prepareSharedCheckout).toHaveBeenCalledWith(["release-test"], {
        hostReleaseRef: "pstdio@0.34.0",
        ...(ref ? { ref } : {}),
      });
      expect(prepareNamedSource.mock.calls[0]?.[2]).toBe(ref);
      expect(existsSync(join(root, "repo/.pstdio/extensions/release-test/extension.ts"))).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

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
