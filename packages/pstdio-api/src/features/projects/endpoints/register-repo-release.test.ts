import { expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { git } from "pstdio-wt";
import { writeExtension } from "../../extensions/default-extensions-test-fixtures";

test.each(["{hostRelease}", "fixed-release"])("registers mixed catalog defaults with %s", async (catalogRef) => {
  const root = mkdtempSync(join(tmpdir(), "register-release-defaults-"));
  const source = join(root, "catalog-repo");
  const repo = join(root, "project-repo");
  const catalog = join(root, "catalog.json");
  try {
    writeExtension(join(source, "extensions/release-test"), "release-test", "repo");
    await git(source, ["init", "-b", "main"]);
    await git(source, ["add", "."]);
    await git(source, ["-c", "user.name=Test", "-c", "user.email=test@example.com", "commit", "-m", "release"]);
    await git(source, ["tag", "fixed-release"]);
    writeFileSync(join(source, "extensions/release-test/marker.txt"), "host");
    await git(source, ["add", "."]);
    await git(source, ["-c", "user.name=Test", "-c", "user.email=test@example.com", "commit", "-m", "host"]);
    await git(source, ["tag", "test-release"]);
    mkdirSync(repo);
    writeFileSync(
      catalog,
      JSON.stringify({
        version: 1,
        extensions: ["release-test", "explicit-test"].map((installName) => ({
          installName,
          displayName: "Release fixture",
          description: "",
          default: true,
          origin: {
            kind: "git",
            url: pathToFileURL(source).href,
            path: "extensions/release-test",
            ref: catalogRef,
          },
        })),
      }),
    );
    // Catalogs are cached per runtime. A fresh process also proves the packaged-source path.
    const child = Bun.spawn(
      [
        process.execPath,
        "-e",
        `
      import { createTestApp } from ${JSON.stringify(join(import.meta.dirname, "../../../test-utils/create-test-app.ts"))};
      const app = await createTestApp({ release: { source: "git", ref: "test-release" } });
      try {
        const project = await app.deps.projectService.create({ name: "Release defaults" });
        const response = await app.app.request("/v1/projects/" + project.id + "/repos", {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: "project", path: ${JSON.stringify(repo)} }),
        });
        if (response.status !== 201) throw new Error(await response.text());
        const workspace = await app.deps.workspaceService.getDefault(project.id);
        if (!workspace?.is_default) throw new Error("Missing root workspace");
      } finally { await app.close(); }
    `,
      ],
      {
        env: {
          ...process.env,
          PSTDIO_HOME: join(root, "home"),
          PSTDIO_EXTENSION_CATALOG: catalog,
          PSTDIO_DEFAULT_EXTENSIONS: JSON.stringify({
            defaultExtensions: [
              { source: "release-test", installName: "release-test", skipInstall: true },
              { source: "explicit-test", installName: "explicit-test", ref: "test-release", skipInstall: true },
            ],
          }),
        },
        stdout: "pipe",
        stderr: "pipe",
      },
    );
    const [stdout, stderr, status] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ]);
    expect({ status, output: status === 0 ? "" : stdout + stderr }).toEqual({ status: 0, output: "" });
    expect(existsSync(join(repo, ".pstdio/extensions/release-test/extension.ts"))).toBe(true);
    expect(existsSync(join(repo, ".pstdio/extensions/release-test/marker.txt"))).toBe(catalogRef === "{hostRelease}");
    expect(readFileSync(join(repo, ".pstdio/extensions/explicit-test/marker.txt"), "utf8")).toBe("host");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
