import { join } from "node:path";
import { expect, test } from "@playwright/test";
import type { WorkbenchExtensionMetadata } from "pstdio-api-contracts";

const apiPort = Number(process.env.E2E_API_PORT ?? "3200");
const apiBase = `http://localhost:${apiPort}`;
const extensionLabPath = join(import.meta.dirname, "../../../../extensions/extension-lab");

const bypassOnboarding = async (
  page: import("@playwright/test").Page,
  projectId: string,
  agentId = "pstdio.harness-lab.fake",
) => {
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
  return (await response.json()) as WorkbenchExtensionMetadata;
};

test.describe("Extension webviews", () => {
  test.beforeEach(async ({ request }) => {
    await deleteAllProjects(request);
  });
  test("loads managed webviews and routes host calls through the shell bridge", async ({ page, request }) => {
    const project = await createProject(request);

    await enableExtension(request, project.id, {
      displayName: "Extension Lab",
      extensionId: "pstdio.extension-lab",
      installName: "extension-lab",
      name: "extension-lab",
      sourcePath: extensionLabPath,
      version: "0.1.0",
    });

    const metadata = await fetchMetadata(request, project.id);
    const labRoute = metadata.routes.find((route) => route.path === "lab");
    expect(labRoute?.webview.moduleUrl).toBeTruthy();

    await expect
      .poll(async () => {
        const response = await request.get(`${apiBase}${labRoute!.webview.moduleUrl}`);
        return response.status();
      })
      .toBe(200);

    await bypassOnboarding(page, project.id);

    await page.goto(`/projects/${project.id}/extensions/lab`);
    const labIframe = page.locator('iframe[title="Lab"]');
    await expect(labIframe).toBeVisible();
    await expect(labIframe).not.toHaveAttribute("sandbox", /allow-same-origin/);
    await expect(
      page.frameLocator('iframe[title="Lab"]').getByRole("heading", { name: "Sandbox webview" }),
    ).toBeVisible();

    // The route renders through `ShellWorkbench`: the lab guest reaches the dashboard host
    // bridge via the shell renderer's injected host capabilities. Clicking "Say hello" calls
    // `notification.show`, which the dashboard surfaces as a single toast in the host document.
    await page.frameLocator('iframe[title="Lab"]').getByRole("button", { name: "Say hello" }).click();
    await expect(page.getByText("Hello from Extension Lab")).toBeVisible();
  });
});
