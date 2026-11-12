import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { WorkbenchExtensionMetadata } from "pstdio-api-contracts";
import { hostFixtureSources } from "../fixtures/host-fixtures";
import { preparePackagedExtensionSource } from "../packaged/packaged-extension-source";
import { cleanupDirs, createGitRepo, runPstdio } from "./helpers";
import { type ApiInstance, startApi } from "./start-api";
import { SETUP_TIMEOUT, TEST_TIMEOUT } from "./timeouts";

let api: ApiInstance;
const fixtureRoot = mkdtempSync(join(tmpdir(), "webview-cli-fixture-"));
let fixturePath: string;
const dirs: string[] = [];

beforeAll(async () => {
  fixturePath = await preparePackagedExtensionSource(fixtureRoot, hostFixtureSources.webview, { install: true });
  api = await startApi({ env: { PSTDIO_DEFAULT_EXTENSIONS: "[]", PSTDIO_EXTENSION_WEBVIEW_BUILDS: "1" } });
}, SETUP_TIMEOUT);

afterAll(async () => {
  await api?.stop();
  rmSync(fixtureRoot, { recursive: true, force: true });
});

afterEach(() => {
  cleanupDirs(dirs);
});

const run = (args: string, cwd: string) =>
  runPstdio(args, cwd, { PSTDIO_API_URL: api.url, PSTDIO_DEFAULT_EXTENSIONS: "[]" });

const readProjectId = (repo: string) => {
  const config = JSON.parse(readFileSync(join(repo, ".pstdio", "config.json"), "utf8")) as { project_id: string };
  return config.project_id;
};

const enableWebviewFixture = async (projectId: string) => {
  const response = await fetch(`${api.url}/v1/projects/${projectId}/extensions/installed/webview-host/enable`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      displayName: "Webview host fixture",
      extensionId: "test.webview-host",
      manifest: { id: "test.webview-host", name: "webview-host" },
      name: "webview-host",
      sourceHash: "e2e-webview-host",
      sourceKind: "local_path",
      sourcePath: fixturePath,
      sourceRef: null,
      version: "0.1.0",
    }),
  });
  expect(response.status).toBe(200);
};

const fetchMetadata = async (projectId: string) => {
  const response = await fetch(`${api.url}/v1/projects/${projectId}/extensions/ui`);
  expect(response.status).toBe(200);
  return (await response.json()) as WorkbenchExtensionMetadata;
};

const waitForOk = async (url: string) => {
  const deadline = Date.now() + 15_000;
  let status = 0;

  while (Date.now() < deadline) {
    const response = await fetch(url);
    status = response.status;
    if (response.ok) return response;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(`Timed out waiting for ${url}; last status ${status}`);
};

const expectNoExternalExecutableSource = (content: string) => {
  expect(content).not.toContain("https://");
  expect(content).not.toContain("http://");
  expect(content).not.toContain("esm.sh");
};

describe("extension webview setup", () => {
  test(
    "exposes managed webviews through the local runtime bridge",
    async () => {
      const repo = createGitRepo();
      dirs.push(repo);

      run("projects create extension-webviews-e2e", repo);
      const projectId = readProjectId(repo);
      await enableWebviewFixture(projectId);

      const metadata = await fetchMetadata(projectId);
      const hostView = metadata.views.find((view) => view.localId === "page");
      expect(hostView?.body.kind).toBe("webview");
      if (hostView?.body.kind !== "webview") throw new Error("Host view is not a webview.");

      const installedExtensionId = metadata.extensions.find(
        (extension) => extension.id === hostView.extensionId,
      )?.installedExtensionId;
      expect(installedExtensionId).toBeString();
      const scopePath = `${installedExtensionId}/test.webview-host.view.page`;
      expect(hostView.body.webview.runtimeUrl).toMatch(
        new RegExp(`^/v1/extensions/webviews/[A-Za-z0-9_-]+/${scopePath}/runtime$`),
      );
      expect(hostView.body.webview.moduleUrl).toMatch(
        new RegExp(`^/v1/extensions/webviews/[A-Za-z0-9_-]+/${scopePath}/assets/module\\.js\\?h=.+$`),
      );

      const module = await waitForOk(`${api.url}${hostView.body.webview.moduleUrl}`);
      expect(module.headers.get("content-type")).toContain("application/javascript");

      const runtimeHtml = await waitForOk(`${api.url}${hostView.body.webview.runtimeUrl}`);
      expect(runtimeHtml.headers.get("content-type")).toContain("text/html");
      const runtimeContent = await runtimeHtml.text();
      const runtimeScripts = [...runtimeContent.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)];
      expect(runtimeScripts.some((match) => Boolean(match[1]?.trim()))).toBe(true);
      expectNoExternalExecutableSource(runtimeContent);
    },
    TEST_TIMEOUT,
  );
});
