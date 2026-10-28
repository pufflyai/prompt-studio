import { expect, test } from "bun:test";
import { existsSync, realpathSync } from "node:fs";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import type { InstallExtensionResponse } from "pstdio-api-contracts";
import { folderProjectInput } from "../helpers/folder-project";
import { preparePackagedExtensionSource } from "./packaged-extension-source";
import { runtimeAuthorization, startPackagedServe, stopProcess } from "./packaged-serve-helpers";

test("the installed extension widget exposes installation progress through public host capabilities", async () => {
  const root = await mkdtemp(join(tmpdir(), "packaged-installation-widget-"));
  let host: Awaited<ReturnType<typeof startPackagedServe>> | undefined;
  try {
    const projectFolder = join(root, "project");
    await mkdir(projectFolder);
    await mkdir(join(root, "host"));
    const fixtureRoot = join(projectFolder, ".pstdio/extension-storage/pstdio.pstdio-artifacts/drafts/widget");
    const source = await preparePackagedExtensionSource(
      fixtureRoot,
      join(import.meta.dirname, "../../../../extensions/pstdio-extension-installations"),
    );
    host = await startPackagedServe(join(root, "host"), { PSTDIO_DEFAULT_EXTENSIONS: "[]" });
    const headers = { ...runtimeAuthorization(host.descriptor), "content-type": "application/json" };
    const created = await fetch(`${host.baseUrl}/v1/projects`, {
      method: "POST",
      headers,
      body: JSON.stringify(folderProjectInput({ name: "Installation widget" }, projectFolder)),
    });
    expect(created.status).toBe(201);
    const project = (await created.json()) as { id: string };
    const response = await fetch(`${host.baseUrl}/v1/projects/${project.id}/extensions/install`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        source: { kind: "project-folder", path: relative(projectFolder, source).replaceAll("\\", "/") },
      }),
    });
    expect(response.status).toBe(201);
    const installed = (await response.json()) as InstallExtensionResponse;
    expect(installed.source.check.errorCount).toBe(0);
    const sdk = realpathSync(join(installed.source.targetPath, "node_modules/@pstdio/sdk"));
    expect(relative(realpathSync(installed.source.targetPath), sdk).startsWith("..")).toBe(false);
    expect(existsSync(join(installed.source.targetPath, "node_modules/@storybook/react"))).toBe(false);
    const metadata = await fetch(`${host.baseUrl}/v1/projects/${project.id}/extensions/ui`, { headers });
    expect(metadata.status).toBe(200);
    expect((await metadata.json()).statusBarItems).toContainEqual(
      expect.objectContaining({
        extensionId: "pstdio.pstdio-extension-installations",
        visibilitySetting: "installations.visible",
        popover: expect.objectContaining({ id: "details" }),
      }),
    );
    const jobs = await fetch(`${host.baseUrl}/v1/extension-installations`, { headers });
    expect(jobs.status).toBe(200);
    expect(await jobs.json()).toContainEqual(
      expect.objectContaining({
        projectId: project.id,
        installName: "extension-source",
        status: "completed",
      }),
    );
  } finally {
    if (host) await stopProcess(host.child);
    await rm(root, { recursive: true, force: true });
  }
});
