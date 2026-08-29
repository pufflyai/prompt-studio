import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { OpenAPIHono } from "@hono/zod-openapi";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { git } from "pstdio-wt";
import { createTestApp } from "../../../test-utils/create-test-app";
import type { AppBindings } from "../../../types";
import { testHarnessId } from "../../harnesses/test-harness-registry";

let app: OpenAPIHono<AppBindings>;
let closeApp: () => Promise<void>;
let tempRoot: string;
let projectId: string;
let labInstanceId: string;
let otherInstanceId: string;
let mountRoot: string;
let previousPstdioHome: string | undefined;
let previousDefaultExtensions: string | undefined;

const pngBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x01, 0x02, 0x03]);

const writeExtension = (name: string, withMount: boolean) => {
  const extensionRoot = join(tempRoot, "extensions", name);
  mkdirSync(extensionRoot, { recursive: true });
  writeFileSync(
    join(extensionRoot, "package.json"),
    JSON.stringify({
      name,
      version: "1.0.0",
      displayName: name,
      publisher: "pstdio",
      main: "./extension.ts",
      engines: { pstdio: EXTENSION_API_VERSION },
    }),
  );
  const mounts = withMount
    ? `artifactMounts: [{ id: "runs", ref: { kind: "artifact-mount", id: "runs" }, path: "runs", label: "Runs" }],`
    : "";
  writeFileSync(join(extensionRoot, "extension.ts"), `export default { ${mounts} };`);
  return extensionRoot;
};

const enableExtension = async (name: string, withMount: boolean) => {
  const sourcePath = writeExtension(name, withMount);
  const response = await app.request(`/v1/projects/${projectId}/extensions/installed/${name}/enable`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      displayName: name,
      extensionId: `pstdio.${name}`,
      manifest: { id: `pstdio.${name}`, name },
      name,
      sourceHash: null,
      sourceKind: "local_path",
      sourcePath,
      sourceRef: null,
      version: null,
    }),
  });
  expect(response.status).toBe(200);
  return ((await response.json()) as { instanceId: string }).instanceId;
};

const artifactsPath = (instanceId: string, mountId: string, resource: string, query = "") =>
  `/v1/projects/${projectId}/extensions/${instanceId}/artifacts/${mountId}/${resource}${query}`;

beforeEach(async () => {
  tempRoot = mkdtempSync(join(tmpdir(), "pstdio-extension-artifacts-test-"));
  previousPstdioHome = process.env.PSTDIO_HOME;
  previousDefaultExtensions = process.env.PSTDIO_DEFAULT_EXTENSIONS;
  process.env.PSTDIO_HOME = join(tempRoot, "home");
  process.env.PSTDIO_DEFAULT_EXTENSIONS = "[]";

  const created = await createTestApp({
    databasePath: ":memory:",
    storageRoot: join(tempRoot, "storage"),
  });
  app = created.app;
  closeApp = created.close;

  const projectResponse = await app.request("/v1/projects", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "Artifacts Project", agents: [testHarnessId("opencode")] }),
  });
  projectId = ((await projectResponse.json()) as { id: string }).id;
  labInstanceId = await enableExtension("lab", true);
  otherInstanceId = await enableExtension("other", false);

  const repoDir = join(tempRoot, "repo");
  await Bun.write(join(repoDir, "README.md"), "# artifacts\n");
  await git(repoDir, ["init", "-b", "main"]);
  const repoResponse = await app.request(`/v1/projects/${projectId}/repos`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "artifacts-repo", path: repoDir }),
  });
  expect(repoResponse.status).toBe(201);

  mountRoot = join(repoDir, ".pstdio", "extension-storage", "lab", "runs");
  mkdirSync(join(mountRoot, "a"), { recursive: true });
  writeFileSync(join(mountRoot, "a", "chart.png"), pngBytes);
  writeFileSync(join(mountRoot, "a", "summary.json"), '{"score":1}');
  writeFileSync(join(mountRoot, "vector.svg"), "<svg/>");
});

afterEach(async () => {
  await closeApp();
  if (previousPstdioHome === undefined) {
    delete process.env.PSTDIO_HOME;
  } else {
    process.env.PSTDIO_HOME = previousPstdioHome;
  }
  if (previousDefaultExtensions === undefined) {
    delete process.env.PSTDIO_DEFAULT_EXTENSIONS;
  } else {
    process.env.PSTDIO_DEFAULT_EXTENSIONS = previousDefaultExtensions;
  }
  rmSync(tempRoot, { recursive: true, force: true });
});

describe("extension artifact endpoints", () => {
  test("lists artifact metadata with media types, optionally under a prefix", async () => {
    const response = await app.request(artifactsPath(labInstanceId, "runs", "files"));
    expect(response.status).toBe(200);
    const { files } = (await response.json()) as { files: Array<Record<string, unknown>> };
    expect(files).toEqual([
      { path: "a/chart.png", size: pngBytes.byteLength, mediaType: "image/png" },
      { path: "a/summary.json", size: 11, mediaType: "application/json" },
      { path: "vector.svg", size: 6, mediaType: "image/svg+xml" },
    ]);

    const scoped = await app.request(artifactsPath(labInstanceId, "runs", "files", "?prefix=a/"));
    const scopedFiles = ((await scoped.json()) as { files: Array<{ path: string }> }).files;
    expect(scopedFiles.map((file) => file.path)).toEqual(["a/chart.png", "a/summary.json"]);

    const escaped = await app.request(artifactsPath(labInstanceId, "runs", "files", "?prefix=../"));
    expect(escaped.status).toBe(400);
  });

  test("reads text artifacts and rejects traversal and oversize reads", async () => {
    const response = await app.request(artifactsPath(labInstanceId, "runs", "text", "?path=a/summary.json"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ content: '{"score":1}' });

    const missing = await app.request(artifactsPath(labInstanceId, "runs", "text", "?path=a/missing.json"));
    expect(missing.status).toBe(404);

    const traversal = await app.request(
      artifactsPath(labInstanceId, "runs", "text", `?path=${encodeURIComponent("../../../etc/passwd")}`),
    );
    expect(traversal.status).toBe(404);

    writeFileSync(join(mountRoot, "big.txt"), Buffer.alloc(5 * 1024 * 1024 + 1));
    const oversize = await app.request(artifactsPath(labInstanceId, "runs", "text", "?path=big.txt"));
    expect(oversize.status).toBe(413);
    expect(((await oversize.json()) as { error: string }).error).toContain("5242880");
  });

  test("mints short-lived image URLs that serve allowlisted bytes through the asset realm", async () => {
    const response = await app.request(
      artifactsPath(labInstanceId, "runs", "image-url", "?path=a/chart.png&webviewId=report"),
    );
    expect(response.status).toBe(200);
    const { url } = (await response.json()) as { url: string };
    expect(url).toMatch(/^\/v1\/extensions\/webviews\/.+\/artifacts\/\d+\/.+\/runs\/a\/chart\.png$/);

    const image = await app.request(url);
    expect(image.status).toBe(200);
    expect(image.headers.get("content-type")).toBe("image/png");
    expect(Buffer.from(await image.arrayBuffer())).toEqual(pngBytes);

    // The signature binds the mount: pointing the same URL at another mount fails.
    const tampered = await app.request(url.replace("/runs/", "/secrets/"));
    expect(tampered.status).toBe(404);
  });

  test("refuses image URLs for media types outside the raster allowlist", async () => {
    const svg = await app.request(
      artifactsPath(labInstanceId, "runs", "image-url", "?path=vector.svg&webviewId=report"),
    );
    expect(svg.status).toBe(415);

    const missing = await app.request(
      artifactsPath(labInstanceId, "runs", "image-url", "?path=a/missing.png&webviewId=report"),
    );
    expect(missing.status).toBe(404);
  });

  test("resolves mounts only through the extension that defines them", async () => {
    const unknownMount = await app.request(artifactsPath(labInstanceId, "secrets", "files"));
    expect(unknownMount.status).toBe(404);

    // "other" defines no mounts, so lab's mount is unreachable through it.
    const foreign = await app.request(artifactsPath(otherInstanceId, "runs", "files"));
    expect(foreign.status).toBe(404);

    const unknownInstance = await app.request(artifactsPath("00000000-0000-0000-0000-000000000000", "runs", "files"));
    expect(unknownInstance.status).toBe(404);
  });
});
