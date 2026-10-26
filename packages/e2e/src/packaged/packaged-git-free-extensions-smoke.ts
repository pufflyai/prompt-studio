import { expect } from "bun:test";
import type { ChildProcess } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { folderProjectInput } from "../helpers/folder-project";
import { runtimeAuthorization, startPackagedServe, stopProcess } from "./packaged-serve-helpers";

export const expectPackagedGitFreeExtensions = async () => {
  const root = mkdtempSync(join(tmpdir(), "pstdio-packaged-no-git-"));
  let child: ChildProcess | undefined;
  try {
    const repository = join(root, "repository");
    const extension = join(repository, "extensions", "demo");
    mkdirSync(extension, { recursive: true });
    writeFileSync(
      join(extension, "package.json"),
      JSON.stringify({
        name: "demo",
        publisher: "test",
        version: "1.0.0",
        main: "./extension.ts",
        engines: { pstdio: `^${EXTENSION_API_VERSION}` },
      }),
    );
    writeFileSync(join(extension, "extension.ts"), "export default {};\n");
    for (const args of [
      ["init"],
      ["add", "."],
      ["-c", "user.name=Test", "-c", "user.email=test@example.com", "commit", "-m", "Extension release"],
      ["tag", "release"],
    ]) {
      const result = Bun.spawnSync(["git", ...args], { cwd: repository });
      expect(result.exitCode, result.stderr.toString()).toBe(0);
    }
    const catalog = join(root, "catalog.json");
    writeFileSync(
      catalog,
      JSON.stringify({
        version: 1,
        extensions: [
          {
            installName: "demo",
            displayName: "Demo",
            description: "Git-free installation fixture",
            default: true,
            origin: { kind: "git", url: pathToFileURL(repository).href, path: "extensions/demo", ref: "release" },
          },
        ],
      }),
    );
    const started = await startPackagedServe(root, {
      PATH: join(root, "no-executables"),
      PSTDIO_EXTENSION_CATALOG: catalog,
      PSTDIO_DEFAULT_EXTENSIONS: JSON.stringify([{ source: "demo", skipInstall: true }]),
      PSTDIO_EXTENSION_RELEASE_REF: "release",
    });
    child = started.child;
    const projectFolder = join(root, "project");
    mkdirSync(projectFolder);
    const headers = { ...runtimeAuthorization(started.descriptor), "content-type": "application/json" };
    const response = await fetch(`${started.baseUrl}/v1/projects`, {
      method: "POST",
      headers,
      body: JSON.stringify(folderProjectInput({ name: "Git-free extensions" }, projectFolder)),
    });
    expect(response.status).toBe(201);
    const project = (await response.json()) as { id: string; extension_warnings?: unknown[] };
    expect(project.extension_warnings).toBeUndefined();
    const installed = await fetch(`${started.baseUrl}/v1/projects/${project.id}/extensions`, { headers });
    expect(installed.status).toBe(200);
    const body = (await installed.json()) as {
      extensions: { installName: string; enabled: boolean; canUpgrade: boolean }[];
    };
    expect(body.extensions).toContainEqual(
      expect.objectContaining({ installName: "demo", enabled: true, canUpgrade: false }),
    );
  } finally {
    if (child) await stopProcess(child);
    rmSync(root, { recursive: true, force: true });
  }
};
