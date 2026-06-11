import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";

const apiPort = Number(process.env.E2E_API_PORT ?? "3200");
const apiBase = `http://localhost:${apiPort}`;
const extensionLabPath = join(import.meta.dirname, "../../../../extensions/extension-lab");

const bypassOnboarding = async (page: import("@playwright/test").Page, projectId: string) => {
  await page.addInitScript((currentProjectId: string) => {
    localStorage.setItem("onboarding-complete", "true");
    localStorage.setItem("selected-agent", "pstdio.harness-lab.fake");
    localStorage.setItem(
      `pstdio-project-settings/projects/${currentProjectId}/values`,
      JSON.stringify({
        state: {
          lastSelectedAgent: "fake",
          lastSelectedBranches: [],
          lastSelectedModels: [],
          lastSelectedRepo: "",
          selectedSessionId: null,
          sessionModalState: "closed",
        },
        version: 0,
      }),
    );
  }, projectId);
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

const enableExtension = async (
  request: import("@playwright/test").APIRequestContext,
  projectId: string,
  sourcePath: string,
) => {
  const response = await request.post(`${apiBase}/v1/projects/${projectId}/extensions/installed/extension-lab/enable`, {
    data: {
      displayName: "Extension Lab",
      extensionId: "pstdio.extension-lab",
      manifest: { id: "pstdio.extension-lab", name: "extension-lab" },
      name: "extension-lab",
      sourceHash: "extension-lab-live-reload-e2e",
      sourceKind: "local_path",
      sourcePath,
      sourceRef: null,
      version: "0.1.0",
    },
  });
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
      await enableExtension(request, project.id, extensionRoot);
      await bypassOnboarding(page, project.id);

      await page.goto(`/projects/${project.id}/extensions/lab`);
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
});
