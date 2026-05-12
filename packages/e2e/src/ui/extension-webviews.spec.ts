import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import type { DashboardExtensionMetadata } from "pstdio-api-contracts";

const apiPort = Number(process.env.E2E_API_PORT ?? "3200");
const apiBase = `http://localhost:${apiPort}`;
const extensionLabPath = join(import.meta.dirname, "../../../../extensions/extension-lab");

const tempDirs: string[] = [];

const bypassOnboarding = async (page: import("@playwright/test").Page, projectId: string, agentId = "fake") => {
  await page.addInitScript(
    ({ currentProjectId, currentAgentId }: { currentProjectId: string; currentAgentId: string }) => {
      localStorage.setItem("onboarding-complete", "true");
      localStorage.setItem("selected-agent", currentAgentId);
      localStorage.setItem(
        `pstdio-project-settings/projects/${currentProjectId}/values`,
        JSON.stringify({
          state: {
            lastSelectedAgent: currentAgentId,
            lastSelectedModels: [],
            lastSelectedRepo: "",
            lastSelectedBranches: [],
            sessionModalState: "closed",
            selectedSessionId: null,
          },
          version: 0,
        }),
      );
    },
    { currentProjectId: projectId, currentAgentId: agentId },
  );
};

const deleteAllProjects = async (request: import("@playwright/test").APIRequestContext) => {
  const res = await request.get(`${apiBase}/v1/projects`);
  const projects = (await res.json()) as { id: string }[];
  for (const project of projects) {
    await request.delete(`${apiBase}/v1/projects/${project.id}`);
  }
};

const createProject = async (request: import("@playwright/test").APIRequestContext) => {
  const response = await request.post(`${apiBase}/v1/projects`, {
    data: { name: "Extension Webviews Project" },
  });
  expect(response.ok()).toBe(true);
  return (await response.json()) as { id: string };
};

const writeStaticExtension = () => {
  const root = mkdtempSync(join(tmpdir(), "pstdio-ui-static-webview-"));
  tempDirs.push(root);
  mkdirSync(root, { recursive: true });
  writeFileSync(
    join(root, "package.json"),
    JSON.stringify({
      name: "staticwebview",
      version: "1.0.0",
      displayName: "Static Webview UI E2E",
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
    '<!doctype html><h1>Static webview e2e</h1><div id="static-script-status"></div><script src="./static.js"></script>',
  );
  writeFileSync(
    join(root, "static.js"),
    "document.getElementById('static-script-status').textContent = 'Static script loaded';",
  );
  return root;
};

const enableExtension = async (
  request: import("@playwright/test").APIRequestContext,
  projectId: string,
  input: {
    displayName: string;
    extensionId: string;
    installName: string;
    name: string;
    sourcePath: string;
    version?: string | null;
  },
) => {
  const response = await request.post(
    `${apiBase}/v1/projects/${projectId}/extensions/installed/${input.installName}/enable`,
    {
      data: {
        displayName: input.displayName,
        extensionId: input.extensionId,
        manifest: { id: input.extensionId, name: input.name },
        name: input.name,
        sourceHash: `${input.installName}-e2e`,
        sourceKind: "local_path",
        sourcePath: input.sourcePath,
        sourceRef: null,
        version: input.version ?? null,
      },
    },
  );
  expect(response.ok()).toBe(true);
};

const fetchMetadata = async (request: import("@playwright/test").APIRequestContext, projectId: string) => {
  const response = await request.get(`${apiBase}/v1/projects/${projectId}/extensions/ui`);
  expect(response.ok()).toBe(true);
  return (await response.json()) as DashboardExtensionMetadata;
};

test.describe("Extension webviews", () => {
  test.beforeEach(async ({ request }) => {
    await deleteAllProjects(request);
  });

  test.afterEach(() => {
    for (const dir of tempDirs) {
      rmSync(dir, { recursive: true, force: true });
    }
    tempDirs.length = 0;
  });

  test("loads static and managed webviews in sandboxed iframes", async ({ page, request }) => {
    const project = await createProject(request);
    const staticExtension = writeStaticExtension();

    await enableExtension(request, project.id, {
      displayName: "Static Webview UI E2E",
      extensionId: "pstdio.staticwebview",
      installName: "static-webview-ui",
      name: "staticwebview",
      sourcePath: staticExtension,
    });
    await enableExtension(request, project.id, {
      displayName: "Extension Lab",
      extensionId: "pstdio.extension-lab",
      installName: "extension-lab",
      name: "extension-lab",
      sourcePath: extensionLabPath,
      version: "0.1.0",
    });

    const metadata = await fetchMetadata(request, project.id);
    const staticRoute = metadata.routes.find((route) => route.path === "static-webview");
    const labRoute = metadata.routes.find((route) => route.path === "lab");
    expect(staticRoute?.webview.assetUrl).toBeTruthy();
    expect(labRoute?.webview.moduleUrl).toBeTruthy();

    const staticAsset = await request.get(`${apiBase}${staticRoute!.webview.assetUrl}`);
    expect(staticAsset.status()).toBe(200);
    const staticScript = await request.get(`${apiBase}${staticRoute!.webview.assetUrl}static.js`);
    expect(staticScript.status()).toBe(200);

    await expect
      .poll(async () => {
        const response = await request.get(`${apiBase}${labRoute!.webview.moduleUrl}`);
        return response.status();
      })
      .toBe(200);

    await bypassOnboarding(page, project.id);

    await page.goto(`/projects/${project.id}/extensions/static-webview`);
    const staticIframe = page.locator('iframe[title="Static Webview"]');
    await expect(staticIframe).toBeVisible();
    await expect(staticIframe).not.toHaveAttribute("sandbox", /allow-same-origin/);
    await expect(page.frameLocator('iframe[title="Static Webview"]').getByText("Static script loaded")).toBeVisible();

    await page.goto(`/projects/${project.id}/extensions/lab`);
    const labIframe = page.locator('iframe[title="Lab"]');
    await expect(labIframe).toBeVisible();
    await expect(labIframe).not.toHaveAttribute("sandbox", /allow-same-origin/);
    await expect(
      page.frameLocator('iframe[title="Lab"]').getByRole("heading", { name: "Sandbox webview" }),
    ).toBeVisible();
  });
});
