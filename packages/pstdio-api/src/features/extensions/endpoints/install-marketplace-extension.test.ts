import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTestApp } from "../../../test-utils/create-test-app";
import { hashExtensionSource, loadExtensionSource } from "../extension-runtime";
import { createTestExtensionSource } from "../test-utils/create-test-extension-source";

type AppHandle = Awaited<ReturnType<typeof createTestApp>>;

let handle: AppHandle;
let tempRoot: string;
let previousDefaultExtensions: string | undefined;
let previousExtensionReleaseRef: string | undefined;
let previousPstdioHome: string | undefined;

beforeEach(() => {
  tempRoot = mkdtempSync(join(tmpdir(), "pstdio-marketplace-install-test-"));
  previousDefaultExtensions = process.env.PSTDIO_DEFAULT_EXTENSIONS;
  previousExtensionReleaseRef = process.env.PSTDIO_EXTENSION_RELEASE_REF;
  previousPstdioHome = process.env.PSTDIO_HOME;
  process.env.PSTDIO_DEFAULT_EXTENSIONS = "[]";
  process.env.PSTDIO_EXTENSION_RELEASE_REF = "pstdio@0.27.0";
  process.env.PSTDIO_HOME = join(tempRoot, "home");
});

afterEach(async () => {
  await handle?.close();
  if (previousDefaultExtensions === undefined) delete process.env.PSTDIO_DEFAULT_EXTENSIONS;
  else process.env.PSTDIO_DEFAULT_EXTENSIONS = previousDefaultExtensions;
  if (previousExtensionReleaseRef === undefined) delete process.env.PSTDIO_EXTENSION_RELEASE_REF;
  else process.env.PSTDIO_EXTENSION_RELEASE_REF = previousExtensionReleaseRef;
  if (previousPstdioHome === undefined) delete process.env.PSTDIO_HOME;
  else process.env.PSTDIO_HOME = previousPstdioHome;
  rmSync(tempRoot, { recursive: true, force: true });
});

describe("POST /v1/projects/:projectId/extensions/marketplace/:installName/install", () => {
  test("installs and reinstalls a marketplace extension from the host release", async () => {
    const installExtensionSource = mock(async () => {
      const sourcePath = createTestExtensionSource({
        displayName: "Prompt Studio Planner",
        installName: "pstdio-planner",
        name: "pstdio-planner",
        root: process.env.PSTDIO_HOME!,
        version: "0.11.0",
      });
      const loaded = await loadExtensionSource(sourcePath);
      return {
        check: { errorCount: 0 },
        installName: "pstdio-planner",
        manifest: loaded.manifest,
        metadata: loaded.metadata,
        source: {
          kind: "named" as const,
          name: "pstdio-planner",
          ref: `https://github.com/pufflyai/prompt-studio@${"b".repeat(40)}#extensions/pstdio-planner`,
        },
        sourceHash: hashExtensionSource(sourcePath),
        targetPath: sourcePath,
      } as never;
    });

    handle = await createTestApp({
      databasePath: ":memory:",
      installExtensionSource,
      release: { source: "git", ref: "pstdio@0.27.0" },
      storageRoot: join(tempRoot, "storage"),
    });
    const createResponse = await handle.app.request("/v1/projects", {
      body: JSON.stringify({ name: "Marketplace Install Project" }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    const project = await createResponse.json();

    const before = await (await handle.app.request(`/v1/projects/${project.id}/extensions`)).json();
    expect(
      before.marketplace.find((entry: { installName: string }) => entry.installName === "pstdio-planner"),
    ).toMatchObject({ installed: false });

    const install = () =>
      handle.app.request(`/v1/projects/${project.id}/extensions/marketplace/pstdio-planner/install`, {
        method: "POST",
      });
    const firstInstall = await install();
    expect(firstInstall.status).toBe(200);
    const first = await firstInstall.json();
    expect(first.extension).toMatchObject({
      canUpgrade: false,
      enabled: true,
      installName: "pstdio-planner",
      version: "0.11.0",
    });
    await handle.deps.extensionStorageService.setCollectionItem({
      collection: "tickets",
      extension_instance_id: first.extension.id,
      item_id: "PS-1",
      project_id: project.id,
      scope_id: project.id,
      scope_type: "project",
      value_json: { title: "Keep me" },
    });

    const remove = await handle.app.request(`/v1/projects/${project.id}/extensions/${first.extension.id}`, {
      method: "DELETE",
    });
    expect(remove.status).toBe(204);
    const afterRemove = await (await handle.app.request(`/v1/projects/${project.id}/extensions`)).json();
    expect(
      afterRemove.marketplace.find((entry: { installName: string }) => entry.installName === "pstdio-planner"),
    ).toMatchObject({ installed: false });

    const reinstall = await install();
    expect(reinstall.status).toBe(200);
    const reinstalled = await reinstall.json();
    expect(reinstalled.extension.id).toBe(first.extension.id);
    expect(
      await handle.deps.extensionStorageService.listCollection({
        collection: "tickets",
        extension_instance_id: first.extension.id,
        scope_id: project.id,
        scope_type: "project",
      }),
    ).toHaveLength(1);
    expect(installExtensionSource).toHaveBeenCalledTimes(2);
    expect(installExtensionSource).toHaveBeenLastCalledWith(
      expect.objectContaining({
        installName: "pstdio-planner",
        ref: "pstdio@0.27.0",
        source: "pstdio-planner",
      }),
    );
  });
});
