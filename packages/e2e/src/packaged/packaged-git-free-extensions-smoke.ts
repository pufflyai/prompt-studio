import { expect } from "bun:test";
import type { ChildProcess } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { folderProjectInput } from "../helpers/folder-project";
import { startLocalWorkspaceRegistry } from "../local-workspace-registry";
import { runtimeAuthorization, startPackagedServe, stopProcess } from "./packaged-serve-helpers";

export const expectPackagedGitFreeExtensions = async () => {
  const root = mkdtempSync(join(tmpdir(), "pstdio-packaged-no-git-"));
  const npmConfigPath = join(root, ".npmrc");
  const registry = await startLocalWorkspaceRegistry({
    configPath: npmConfigPath,
    outputRoot: root,
    packagePaths: [join(import.meta.dirname, "../../../sdk")],
  });
  let child: ChildProcess | undefined;
  try {
    const pathKey = Object.keys(process.env).find((key) => key.toUpperCase() === "PATH") ?? "PATH";
    const started = await startPackagedServe(root, {
      [pathKey]: join(root, "no-executables"),
      PATH: join(root, "no-executables"),
      NPM_CONFIG_USERCONFIG: npmConfigPath,
      PSTDIO_EXTENSION_CATALOG: "",
      PSTDIO_DEFAULT_EXTENSIONS: JSON.stringify([{ source: "pstdio-skills" }]),
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
      expect.objectContaining({ installName: "pstdio-skills", enabled: true, canUpgrade: false }),
    );
    const providers = await fetch(`${started.baseUrl}/v1/projects/${project.id}/workspace-providers`, { headers });
    expect(providers.status).toBe(200);
    expect(await providers.json()).toEqual([]);
    const gitInstall = await fetch(`${started.baseUrl}/v1/projects/${project.id}/extensions/install`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        source: { kind: "catalog", name: "pstdio-skills", ref: "main" },
        installName: "git-skills",
        skipInstall: true,
      }),
    });
    expect(gitInstall.status).toBe(409);
    expect(await gitInstall.json()).toMatchObject({ code: "git_unavailable" });
  } finally {
    if (child) await stopProcess(child);
    await registry.close();
    rmSync(root, { recursive: true, force: true });
  }
};
