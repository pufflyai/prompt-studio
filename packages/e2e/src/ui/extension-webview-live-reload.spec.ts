import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import type { WorkbenchExtensionMetadata } from "pstdio-api-contracts";

const apiPort = Number(process.env.E2E_API_PORT ?? "3200");
const apiBase = `http://localhost:${apiPort}`;
const extensionLabPath = join(import.meta.dirname, "../../../../extensions/extension-lab");
const missingDependencyName = "pstdio-live-reload-dep";
const recoveredHeading = "Recovered webview";

const declareMissingWebviewDependency = (extensionRoot: string) => {
  const manifestPath = join(extensionRoot, "package.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
    dependencies: Record<string, string>;
  };
  manifest.dependencies[missingDependencyName] = "1.0.0";
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  const viewFile = join(extensionRoot, "src/views/lab-page.tsx");
  const source = readFileSync(viewFile, "utf8").replace('"Sandbox webview"', `"${recoveredHeading}"`);
  writeFileSync(viewFile, `import "${missingDependencyName}";\n${source}`);
};

const installMissingWebviewDependency = (extensionRoot: string) => {
  const dependencyPath = join(extensionRoot, "node_modules", missingDependencyName);
  mkdirSync(dependencyPath, { recursive: true });
  writeFileSync(
    join(dependencyPath, "package.json"),
    JSON.stringify({ exports: "./index.js", name: missingDependencyName, type: "module", version: "1.0.0" }),
  );
  writeFileSync(join(dependencyPath, "index.js"), "export {};\n");
  writeFileSync(join(extensionRoot, "bun.lock"), "// dependency installation completed\n");
};

const bypassOnboarding = async (
  page: import("@playwright/test").Page,
  projectId: string,
  route: WorkbenchExtensionMetadata["routes"][number],
) => {
  await page.addInitScript(
    ({ currentProjectId, currentRoute }) => {
      localStorage.setItem("onboarding-complete", "true");
      localStorage.setItem("selected-agent", "pstdio.extension-lab.fake");
      localStorage.setItem("dashboard-wb:selected-project:global", currentProjectId);
      localStorage.setItem(
        `dashboard-wb:last-resource:${currentProjectId}`,
        JSON.stringify({
          kind: "extension-route",
          uri: `dashboard-workbench://project/${currentProjectId}/extensions/${currentRoute.path}`,
          id: currentRoute.path,
          label: "Lab",
          metadata: { projectId: currentProjectId, routePath: currentRoute.path, route: currentRoute },
        }),
      );
      localStorage.setItem(
        `pstdio-project-settings/projects/${currentProjectId}/values`,
        JSON.stringify({
          state: {
            lastSelectedAgent: "pstdio.extension-lab.fake",
            lastSelectedBranches: [],
            lastSelectedModels: [],
            lastSelectedRepo: "",
            selectedSessionId: null,
            sessionModalState: "closed",
          },
          version: 0,
        }),
      );
    },
    { currentProjectId: projectId, currentRoute: route },
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
    data: { name: "Extension Webview Live Reload" },
  });
  expect(response.ok()).toBe(true);
  return (await response.json()) as { id: string };
};

const disableDefaultExtensionLab = async (request: import("@playwright/test").APIRequestContext, projectId: string) => {
  const response = await request.get(`${apiBase}/v1/projects/${projectId}/extensions`);
  expect(response.ok()).toBe(true);
  const body = (await response.json()) as { extensions: Array<{ id: string; installName: string }> };

  for (const extension of body.extensions.filter((entry) => entry.installName === "extension-lab")) {
    const disabled = await request.patch(`${apiBase}/v1/projects/${projectId}/extensions/${extension.id}`, {
      data: { enabled: false },
    });
    expect(disabled.ok()).toBe(true);
  }
};

const enableExtension = async (
  request: import("@playwright/test").APIRequestContext,
  projectId: string,
  sourcePath: string,
  installName = "extension-lab-live-reload",
) => {
  const response = await request.post(
    `${apiBase}/v1/projects/${projectId}/extensions/installed/${installName}/enable`,
    {
      data: {
        displayName: "Extension Lab",
        extensionId: "pstdio.extension-lab",
        manifest: { id: "pstdio.extension-lab", name: "extension-lab" },
        name: "extension-lab",
        sourceHash: `${installName}-e2e`,
        sourceKind: "local_path",
        sourcePath,
        sourceRef: null,
        version: "0.1.0",
      },
    },
  );
  expect(response.ok()).toBe(true);
};

test.describe("Extension webview live reload", () => {
  test.beforeEach(async ({ request }) => {
    await deleteAllProjects(request);
  });

  test("updates an open dashboard webview after editing its source", async ({ page, request }, testInfo) => {
    const extensionRoot = mkdtempSync(join(tmpdir(), "pstdio-extension-lab-live-reload-"));
    cpSync(extensionLabPath, extensionRoot, { recursive: true });

    try {
      const project = await createProject(request);
      await disableDefaultExtensionLab(request, project.id);
      await enableExtension(request, project.id, extensionRoot);
      const metadataResponse = await request.get(`${apiBase}/v1/projects/${project.id}/extensions/ui`);
      expect(metadataResponse.ok()).toBe(true);
      const metadata = (await metadataResponse.json()) as WorkbenchExtensionMetadata;
      const labRoute = metadata.routes.find((route) => route.path === "lab");
      expect(labRoute).toBeDefined();
      await bypassOnboarding(page, project.id, labRoute!);

      await page.goto(`/projects/${project.id}`);
      const frame = page.frameLocator('iframe[title="Lab"]');
      await expect(frame.getByRole("heading", { name: "Sandbox webview" })).toBeVisible();

      const nextHeading = `Sandbox webview ${Date.now()}`;
      const viewFile = join(extensionRoot, "src/views/lab-page.tsx");
      const current = readFileSync(viewFile, "utf8");
      writeFileSync(viewFile, current.replace('"Sandbox webview"', `"${nextHeading}"`));

      const startedAt = Date.now();
      await expect(frame.getByRole("heading", { name: nextHeading })).toBeVisible({ timeout: 5_000 });
      const elapsedMs = Date.now() - startedAt;

      await testInfo.attach("webview-live-reload-elapsed-ms", {
        body: String(elapsedMs),
        contentType: "text/plain",
      });
      console.info(`webview live reload elapsed: ${elapsedMs}ms`);
      expect(elapsedMs).toBeLessThan(5_000);
    } finally {
      rmSync(extensionRoot, { recursive: true, force: true });
    }
  });

  test("recovers an open webview after its missing dependency is installed", async ({ page, request }) => {
    const extensionRoot = mkdtempSync(join(tmpdir(), "pstdio-extension-dependency-recovery-"));
    const installName = "extension-lab-dependency-recovery";
    cpSync(extensionLabPath, extensionRoot, { recursive: true });

    try {
      const project = await createProject(request);
      await disableDefaultExtensionLab(request, project.id);
      await enableExtension(request, project.id, extensionRoot, installName);

      const metadataResponse = await request.get(`${apiBase}/v1/projects/${project.id}/extensions/ui`);
      expect(metadataResponse.ok()).toBe(true);
      const metadata = (await metadataResponse.json()) as WorkbenchExtensionMetadata;
      const labRoute = metadata.routes.find((route) => route.path === "lab");
      expect(labRoute).toBeDefined();
      await bypassOnboarding(page, project.id, labRoute!);
      await page.goto(`/projects/${project.id}`);

      const frame = page.frameLocator('iframe[title="Lab"]');
      await expect(frame.getByRole("heading", { name: "Sandbox webview" })).toBeVisible();

      declareMissingWebviewDependency(extensionRoot);
      await expect
        .poll(async () => {
          const response = await request.get(`${apiBase}/v1/projects/${project.id}/extensions`);
          const body = (await response.json()) as {
            extensions: Array<{ installName: string; lastError?: Record<string, unknown> | null; status: string }>;
          };
          const extension = body.extensions.find((entry) => entry.installName === installName);
          return JSON.stringify({ lastError: extension?.lastError, status: extension?.status });
        })
        .toContain(`Missing extension webview dependencies: ${missingDependencyName}`);

      installMissingWebviewDependency(extensionRoot);

      await expect(frame.getByRole("heading", { name: recoveredHeading })).toBeVisible({ timeout: 5_000 });
    } finally {
      rmSync(extensionRoot, { recursive: true, force: true });
    }
  });
});
