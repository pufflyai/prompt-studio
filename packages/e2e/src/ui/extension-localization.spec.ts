import { join } from "node:path";
import { expect, test } from "@playwright/test";
import type { WorkbenchExtensionMetadata } from "pstdio-api-contracts";

const apiPort = Number(process.env.E2E_API_PORT ?? "3200");
const apiBase = `http://localhost:${apiPort}`;
const extensionLabPath = join(import.meta.dirname, "../../../../extensions/extension-lab");

const deleteAllProjects = async (request: import("@playwright/test").APIRequestContext) => {
  const res = await request.get(`${apiBase}/v1/projects`);
  const projects = (await res.json()) as { id: string }[];
  for (const project of projects) {
    await request.delete(`${apiBase}/v1/projects/${project.id}`);
  }
};

const createProject = async (request: import("@playwright/test").APIRequestContext) => {
  const response = await request.post(`${apiBase}/v1/projects`, {
    data: { name: "Extension Lab Localized" },
  });
  expect(response.ok()).toBe(true);
  return (await response.json()) as { id: string; name: string };
};

const enableExtensionLab = async (request: import("@playwright/test").APIRequestContext, projectId: string) => {
  const response = await request.post(`${apiBase}/v1/projects/${projectId}/extensions/installed/extension-lab/enable`, {
    data: {
      displayName: "Extension Lab",
      extensionId: "pstdio.extension-lab",
      manifest: { id: "pstdio.extension-lab", name: "extension-lab" },
      name: "extension-lab",
      sourceHash: "extension-lab-localization-e2e",
      sourceKind: "local_path",
      sourcePath: extensionLabPath,
      sourceRef: null,
      version: "0.1.0",
    },
  });
  expect(response.ok()).toBe(true);
};

const fetchMetadata = async (request: import("@playwright/test").APIRequestContext, projectId: string) => {
  const response = await request.get(`${apiBase}/v1/projects/${projectId}/extensions/ui`);
  expect(response.ok()).toBe(true);
  return (await response.json()) as WorkbenchExtensionMetadata;
};

test.describe("extension-lab localization", () => {
  test.use({ locale: "fr-FR" });

  test.beforeEach(async ({ request }) => {
    await deleteAllProjects(request);
  });

  test("renders translated route and webview copy", async ({ page, request }) => {
    const project = await createProject(request);
    await enableExtensionLab(request, project.id);

    const metadata = await fetchMetadata(request, project.id);
    const labRoute = metadata.routes.find((route) => route.path === "lab");
    expect(labRoute?.webview.moduleUrl).toBeTruthy();

    await expect
      .poll(async () => {
        const response = await request.get(`${apiBase}${labRoute!.webview.moduleUrl}`);
        return response.status();
      })
      .toBe(200);

    await page.goto("/");
    await page.getByRole("option", { name: "Extension Lab Localized" }).click();

    const labRouteItem = page.getByRole("option", { name: "Laboratoire" });
    await expect(labRouteItem).toBeVisible({ timeout: 15_000 });
    await labRouteItem.click();

    const labFrame = page.locator('iframe[title="Laboratoire"]');
    await expect(labFrame).toBeVisible();
    await expect(
      page.frameLocator('iframe[title="Laboratoire"]').getByRole("heading", { name: "Webview bac à sable" }),
    ).toBeVisible();
  });
});
