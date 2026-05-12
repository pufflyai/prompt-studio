import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { DashboardExtensionMetadata } from "pstdio-api-contracts";
import { cleanupDirs, createGitRepo, createTempDir, runPstdio } from "./helpers";
import { type ApiInstance, startApi } from "./start-api";
import { SETUP_TIMEOUT, TEST_TIMEOUT } from "./timeouts";

let api: ApiInstance;
const dirs: string[] = [];

beforeAll(async () => {
  api = await startApi();
}, SETUP_TIMEOUT);

afterAll(() => {
  api?.stop();
});

afterEach(() => {
  cleanupDirs(dirs);
});

const extensionLabPath = join(import.meta.dirname, "../../../../extensions/extension-lab");

const run = (args: string, cwd: string) => runPstdio(args, cwd, { PSTDIO_API_URL: api.url });

const readProjectId = (repo: string) => {
  const config = JSON.parse(readFileSync(join(repo, ".pstdio", "config.json"), "utf8")) as { project_id: string };
  return config.project_id;
};

const writeStaticExtension = () => {
  const root = createTempDir();
  dirs.push(root);
  mkdirSync(root, { recursive: true });
  writeFileSync(
    join(root, "package.json"),
    JSON.stringify({
      name: "staticwebview",
      version: "1.0.0",
      displayName: "Static Webview E2E",
      publisher: "pstdio",
      main: "./extension.ts",
      engines: { pstdio: "^1.0.0" },
    }),
  );
  writeFileSync(
    join(root, "extension.ts"),
    `export default {
      routes: {
        page: {
          path: "static-webview",
          label: "Static Webview",
          webview: { entry: { kind: "package-asset", path: "./static.html", baseUrl: import.meta.url } },
        },
      },
    };`,
  );
  writeFileSync(
    join(root, "static.html"),
    '<!doctype html><h1>Static webview e2e</h1><script src="./static.js"></script>',
  );
  writeFileSync(join(root, "static.js"), "document.body.dataset.staticScript = 'loaded';");
  return root;
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
  return (await response.json()) as DashboardExtensionMetadata;
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
    "exposes static webviews directly and managed webviews through the local runtime bridge",
    async () => {
      const repo = createGitRepo();
      dirs.push(repo);
      const staticExtension = writeStaticExtension();

      run("projects create extension-webviews-e2e", repo);
      const projectId = readProjectId(repo);
      run(`extensions add ${staticExtension} --name static-webview --skip-install`, repo);
      await enableExtensionLab(projectId);

      const metadata = await fetchMetadata(projectId);
      const staticRoute = metadata.routes.find((route) => route.path === "static-webview");
      const labRoute = metadata.routes.find((route) => route.path === "lab");

      expect(staticRoute?.webview.assetUrl).toBe(
        "/v1/extensions/installed/static-webview/webviews/staticwebview.page/",
      );
      expect(staticRoute?.webview.runtimeUrl).toBeUndefined();
      expect(staticRoute?.webview.moduleUrl).toBeUndefined();

      expect(labRoute?.webview.runtimeUrl).toBe("/v1/extensions/runtime");
      expect(labRoute?.webview.moduleUrl).toBe(
        "/v1/extensions/installed/extension-lab/webviews/extension-lab.labPage/module.js",
      );
      expect(labRoute?.webview.assetUrl).toBeUndefined();

      const staticHtml = await waitForOk(`${api.url}${staticRoute!.webview.assetUrl}`);
      expect(await staticHtml.text()).toContain("Static webview e2e");
      const staticScript = await waitForOk(`${api.url}${staticRoute!.webview.assetUrl}static.js`);
      expect(await staticScript.text()).toContain("staticScript");

      const module = await waitForOk(`${api.url}${labRoute!.webview.moduleUrl}`);
      expect(module.headers.get("content-type")).toContain("application/javascript");

      const runtimeHtml = await waitForOk(`${api.url}${labRoute!.webview.runtimeUrl}`);
      const runtimeScript = await waitForOk(`${api.url}/v1/extensions/runtime.js`);
      expectNoExternalExecutableSource(await runtimeHtml.text());
      expectNoExternalExecutableSource(await runtimeScript.text());
    },
    TEST_TIMEOUT,
  );
});
