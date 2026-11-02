import { expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { productionArchivePaths } from "./production-archive";

test("release archives restore declared build outputs needed by packaged consumers", async () => {
  const root = await mkdtemp(join(tmpdir(), "release-archive-"));
  const put = async (path: string, contents: unknown) => {
    await mkdir(dirname(join(root, path)), { recursive: true });
    await writeFile(join(root, path), typeof contents === "string" ? contents : JSON.stringify(contents));
  };
  try {
    await put("package.json", { workspaces: ["packages/*", "extensions/*"] });
    await put("packages/pstdio/package.json", { name: "pstdio" });
    await put("packages/pstdio/dist/bin/pstdio", "compiled host");
    await put("packages/ui/package.json", { name: "@pstdio/ui" });
    await put("packages/ui/.publish/index.js", "export {};");
    await put("extensions/canvas/package.json", {
      name: "canvas",
      nx: { targets: { build: { outputs: ["{projectRoot}/src/catalog/generated"] } } },
    });
    const manifest = "extensions/canvas/src/catalog/generated/frame-manifest.json";
    await put(manifest, { entry: "frame.js" });
    await put("extensions/canvas/src/source.ts", "source stays in the version commit");
    const paths = productionArchivePaths(root);
    expect(paths).toContain("extensions/canvas/src/catalog/generated");
    expect(paths).toContain("packages/ui/.publish");
    expect(paths).not.toContain("extensions/canvas/src/source.ts");
    expect(Bun.spawnSync(["tar", "-czf", "release.tar.gz", ...paths], { cwd: root }).exitCode).toBe(0);
    await rm(join(root, "extensions/canvas/src/catalog/generated"), { recursive: true });
    expect(Bun.spawnSync(["tar", "-xzf", "release.tar.gz"], { cwd: root }).exitCode).toBe(0);
    expect(JSON.parse(await readFile(join(root, manifest), "utf8"))).toEqual({ entry: "frame.js" });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
