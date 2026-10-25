import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { versionPackagePreview } from "./package-preview-version";

test("gives SDK/UI a repeatable preview version without creating a host tag or commit", async () => {
  const root = mkdtempSync(join(tmpdir(), "pstdio-package-preview-"));
  try {
    const names = {
      sdk: "@pstdio/sdk",
      ui: "@pstdio/ui",
      pstdio: "pstdio",
      workbench: "@pstdio/workbench",
      desktop: "@pstdio/desktop",
    };
    mkdirSync(join(root, ".changeset"));
    writeFileSync(
      join(root, "package.json"),
      JSON.stringify({ name: "preview-fixture", private: true, workspaces: ["packages/*"] }),
    );
    writeFileSync(
      join(root, ".changeset/config.json"),
      JSON.stringify({
        changelog: false,
        commit: false,
        fixed: [Object.values(names)],
        access: "public",
        baseBranch: "main",
        updateInternalDependencies: "patch",
        ignore: [],
        snapshot: { useCalculatedVersion: true },
      }),
    );
    for (const [folder, name] of Object.entries(names)) {
      mkdirSync(join(root, "packages", folder), { recursive: true });
      writeFileSync(
        join(root, "packages", folder, "package.json"),
        JSON.stringify({
          name,
          version: "0.45.0",
          ...(folder === "ui" ? { dependencies: { "@pstdio/sdk": "workspace:*" } } : {}),
        }),
      );
    }
    const git = (...args: string[]) => {
      const result = Bun.spawnSync(["git", ...args], { cwd: root });
      if (result.exitCode) throw Error(result.stderr.toString());
      return result.stdout.toString().trim();
    };
    git("init", "-b", "main");
    git("add", ".");
    git("-c", "user.name=Preview test", "-c", "user.email=preview@example.com", "commit", "-m", "Source");
    const source = git("rev-parse", "HEAD");
    const version = await versionPackagePreview(root);
    expect(version).toBe(`0.45.1-preview.sha-${source}`);
    expect(JSON.parse(readFileSync(join(root, "packages/ui/package.json"), "utf8")).version).toBe(version);
    expect(await versionPackagePreview(root)).toBe(version);
    expect(git("rev-parse", "HEAD")).toBe(source);
    expect(git("tag", "--list")).toBe("");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
