import { expect } from "bun:test";
import type { ChildProcess } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { folderProjectInput } from "../helpers/folder-project";
import { startLocalWorkspaceRegistry } from "../local-workspace-registry";
import { runtimeAuthorization, startPackagedServe, stopProcess } from "./packaged-serve-helpers";

const expectExistingRemoteRecovery = async (input: {
  root: string;
  baseUrl: string;
  projectId: string;
  headers: Record<string, string>;
}) => {
  const { root, baseUrl, projectId, headers } = input;
  const source = join(root, "extensions", "remote-workspaces");
  mkdirSync(source, { recursive: true });
  const manifest = {
    publisher: "pstdio",
    name: "remote-workspaces",
    displayName: "Remote Workspaces",
    version: "0.0.1",
    main: "extension.ts",
    engines: { pstdio: "^0.0.9" },
  };
  writeFileSync(join(source, "package.json"), JSON.stringify(manifest));
  writeFileSync(join(source, "extension.ts"), "export default {};");
  const retained = join(root, "project", ".pstdio", "extension-storage", "pstdio.remote-workspaces", "retained.json");
  mkdirSync(join(retained, ".."), { recursive: true });
  writeFileSync(retained, JSON.stringify({ workspace: "existing" }));
  const enabled = await fetch(`${baseUrl}/v1/projects/${projectId}/extensions/installed/remote-workspaces/enable`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      displayName: manifest.displayName,
      extensionId: "pstdio.remote-workspaces",
      installName: manifest.name,
      manifest: { id: "pstdio.remote-workspaces", name: manifest.name, enginesPstdio: manifest.engines.pstdio },
      name: manifest.name,
      sourcePath: source,
      sourceKind: "git",
      version: manifest.version,
      sourceRef: `https://github.com/pufflyai/prompt-studio@${"0".repeat(40)}#extensions/remote-workspaces`,
    }),
  });
  expect(enabled.status).toBe(200);
  const { instanceId } = (await enabled.json()) as { instanceId: string };
  const listed = await fetch(`${baseUrl}/v1/projects/${projectId}/extensions`, { headers });
  expect(listed.status).toBe(200);
  const before = (await listed.json()) as { extensions: { id: string; canUpgrade: boolean }[] };
  expect(before.extensions).toContainEqual(expect.objectContaining({ id: instanceId, canUpgrade: true }));
  const upgraded = await fetch(`${baseUrl}/v1/projects/${projectId}/extensions/${instanceId}/upgrade`, {
    method: "POST",
    headers,
  });
  expect(upgraded.status).toBe(200);
  expect(await upgraded.json()).toMatchObject({
    changed: true,
    extension: { extensionId: "pstdio.remote-workspaces", status: "loaded", canUpgrade: false },
  });
  expect(JSON.parse(readFileSync(retained, "utf8"))).toEqual({ workspace: "existing" });
};

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
      extensions: { installName: string; enabled: boolean; canUpgrade: boolean; sourcePath: string }[];
    };
    expect(body.extensions).toContainEqual(
      expect.objectContaining({ installName: "pstdio-skills", enabled: true, canUpgrade: false }),
    );
    const skills = body.extensions.find((extension) => extension.installName === "pstdio-skills")!;
    const installedManifest = JSON.parse(readFileSync(join(skills.sourcePath, "package.json"), "utf8"));
    const sourceManifest = JSON.parse(
      readFileSync(join(import.meta.dirname, "../../../../extensions/pstdio-skills/package.json"), "utf8"),
    );
    expect(installedManifest).toMatchObject({
      publisher: sourceManifest.publisher,
      name: sourceManifest.name,
      displayName: sourceManifest.displayName,
      icon: sourceManifest.icon,
    });
    expect(installedManifest.icon.length).toBeGreaterThan(0);
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
    await expectExistingRemoteRecovery({ root, baseUrl: started.baseUrl, projectId: project.id, headers });
  } finally {
    if (child) await stopProcess(child);
    await registry.close();
    rmSync(root, { recursive: true, force: true });
  }
};
