import { afterEach, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { alignReleaseBaseline } from "./align-release-baseline";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
  roots.length = 0;
});

test("starts main versioning from the shipped patch while preserving main dependencies and changesets", async () => {
  const root = mkdtempSync(join(tmpdir(), "pstdio-release-baseline-"));
  roots.push(root);
  const git = (...args: string[]) => {
    const result = Bun.spawnSync(["git", ...args], { cwd: root });
    if (result.exitCode !== 0) throw new Error(result.stderr.toString());
  };
  const manifestPath = join(root, "packages/pstdio/package.json");
  mkdirSync(join(root, "packages/pstdio"), { recursive: true });
  mkdirSync(join(root, ".changeset"));
  writeFileSync(join(root, "package.json"), JSON.stringify({ workspaces: ["packages/*"] }));
  writeFileSync(join(root, ".changeset/config.json"), JSON.stringify({ fixed: [["pstdio"]] }));
  writeFileSync(manifestPath, JSON.stringify({ name: "pstdio", version: "0.43.2", dependencies: { dep: "old" } }));
  git("init", "-b", "main");
  git("config", "user.name", "Test");
  git("config", "user.email", "test@example.com");
  git("add", ".");
  git("commit", "-m", "Stable patch");
  git("tag", "pstdio@0.43.2");
  writeFileSync(manifestPath, JSON.stringify({ name: "pstdio", version: "0.43.1", dependencies: { dep: "new" } }));
  writeFileSync(join(root, ".changeset/feature.md"), '---\n"pstdio": minor\n---\n\nNew feature.\n');

  await alignReleaseBaseline(root, "pstdio@0.43.2");

  expect(JSON.parse(readFileSync(manifestPath, "utf8"))).toEqual({
    name: "pstdio",
    version: "0.43.2",
    dependencies: { dep: "new" },
  });
  expect(readFileSync(join(root, ".changeset/feature.md"), "utf8")).toContain("minor");
  writeFileSync(manifestPath, JSON.stringify({ name: "pstdio", version: "0.43.3" }));
  git("add", "packages/pstdio/package.json");
  git("commit", "-m", "Reserve next patch\n\nPatch-Base: pstdio@0.43.2");
  git("tag", "pstdio@0.43.3");
  writeFileSync(manifestPath, JSON.stringify({ name: "pstdio", version: "0.43.2" }));
  await alignReleaseBaseline(root, "pstdio@0.43.2");
  expect(JSON.parse(readFileSync(manifestPath, "utf8")).version).toBe("0.43.3");
  writeFileSync(manifestPath, JSON.stringify({ name: "pstdio", version: "0.44.0" }));
  await alignReleaseBaseline(root, "pstdio@0.43.2");
  expect(JSON.parse(readFileSync(manifestPath, "utf8")).version).toBe("0.44.0");
});
