import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "../../../app";
import { resolveTestFilesRoot } from "../../../test-utils/resolve-test-files-root";
import { hashExtensionSource, loadExtensionSource } from "../extension-runtime";
import { createTestScheduledExtensionSource } from "../test-utils/create-test-extension-source";

type AppHandle = Awaited<ReturnType<typeof createApp>>;

let handle: AppHandle;
let tempRoot: string;
let previousDefaultExtensions: string | undefined;
let previousExtensionReleaseRef: string | undefined;
let previousPstdioHome: string | undefined;

beforeEach(() => {
  tempRoot = mkdtempSync(join(tmpdir(), "pstdio-marketplace-contributions-test-"));
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

describe("GET /v1/projects/:projectId/extensions/marketplace/:installName/contributions", () => {
  test("documents an available extension without installing it for the project", async () => {
    const sourcePath = createTestScheduledExtensionSource({
      displayName: "Prompt Studio Reports",
      installName: "pstdio-reports",
      name: "pstdio-reports",
      root: tempRoot,
      version: "0.3.0",
    });
    const loaded = await loadExtensionSource(sourcePath);
    const installExtensionSource = mock(async () => ({
      check: { errorCount: 0 },
      installName: "pstdio-reports",
      manifest: loaded.manifest,
      metadata: loaded.metadata,
      source: {
        kind: "named" as const,
        name: "pstdio-reports",
        ref: `https://github.com/pufflyai/prompt-studio@${"b".repeat(40)}#extensions/pstdio-reports`,
      },
      sourceHash: hashExtensionSource(sourcePath),
      targetPath: sourcePath,
    }));
    handle = await createApp({
      dbPath: ":memory:",
      filesRoot: resolveTestFilesRoot(),
      installExtensionSource: installExtensionSource as never,
      storagePath: join(tempRoot, "storage"),
    });
    const createResponse = await handle.app.request("/v1/projects", {
      body: JSON.stringify({ name: "Available Contributions Project" }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    const project = await createResponse.json();

    const response = await handle.app.request(
      `/v1/projects/${project.id}/extensions/marketplace/pstdio-reports/contributions`,
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.extensions).toContainEqual(expect.objectContaining({ id: loaded.metadata.id }));
    expect(body.commands).toContainEqual(expect.objectContaining({ id: `${loaded.metadata.id}.command.heartbeat` }));

    const listed = await (await handle.app.request(`/v1/projects/${project.id}/extensions`)).json();
    expect(listed.extensions).toEqual([]);
    expect(
      listed.marketplace.find((entry: { installName: string }) => entry.installName === "pstdio-reports"),
    ).toMatchObject({ installed: false });
    expect(installExtensionSource).toHaveBeenCalledTimes(1);
  });
});
