import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { WorkbenchExtensionMetadata } from "pstdio-api-contracts";
import { cleanupDirs, createGitRepo, runPstdio } from "./helpers";
import { type ApiInstance, startApi } from "./start-api";
import { SETUP_TIMEOUT, TEST_TIMEOUT } from "./timeouts";

let api: ApiInstance;
const dirs: string[] = [];

beforeAll(async () => {
  api = await startApi({ env: { PSTDIO_DEFAULT_EXTENSIONS: "[]", PSTDIO_EXTENSION_WEBVIEW_BUILDS: "1" } });
}, SETUP_TIMEOUT);

afterAll(() => {
  api?.stop();
});

afterEach(() => {
  cleanupDirs(dirs);
});

const extensionLabPath = join(import.meta.dirname, "../../../../extensions/extension-lab");

const run = (args: string, cwd: string) =>
  runPstdio(args, cwd, { PSTDIO_API_URL: api.url, PSTDIO_DEFAULT_EXTENSIONS: "[]" });

const readProjectId = (repo: string) => {
  const config = JSON.parse(readFileSync(join(repo, ".pstdio", "config.json"), "utf8")) as { project_id: string };
  return config.project_id;
};

const enableExtensionLab = async (projectId: string) => {
  const response = await fetch(`${api.url}/v1/projects/${projectId}/extensions/installed/extension-lab/enable`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      displayName: "Extension Lab",
      extensionId: "pstdio.extension-lab",
      manifest: { id: "pstdio.extension-lab", name: "extension-lab" },
      name: "extension-lab",
      sourceHash: "e2e-extension-lab",
      sourceKind: "local_path",
      sourcePath: extensionLabPath,
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
      await enableExtensionLab(projectId);

      const metadata = await fetchMetadata(projectId);
      const labRoute = metadata.routes.find((route) => route.path === "lab");

      expect(labRoute?.webview.runtimeUrl).toMatch(
        /^\/v1\/extensions\/webviews\/[A-Za-z0-9_-]+\/extension-lab\/extension-lab\.labPage\/runtime$/,
      );
      expect(labRoute?.webview.moduleUrl).toMatch(
        /^\/v1\/extensions\/webviews\/[A-Za-z0-9_-]+\/extension-lab\/extension-lab\.labPage\/assets\/module\.js\?h=.+$/,
      );

      const module = await waitForOk(`${api.url}${labRoute!.webview.moduleUrl}`);
      expect(module.headers.get("content-type")).toContain("application/javascript");

      const runtimeHtml = await waitForOk(`${api.url}${labRoute!.webview.runtimeUrl}`);
      const runtimeContent = await runtimeHtml.text();
      expectNoExternalExecutableSource(runtimeContent);
      expect(runtimeContent).toContain("notification.action");
    },
    TEST_TIMEOUT,
  );
});
