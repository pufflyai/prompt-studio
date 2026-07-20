import { join } from "node:path";
import { expect, test } from "@playwright/test";
import type { WorkbenchExtensionMetadata } from "pstdio-api-contracts";

const apiPort = Number(process.env.E2E_API_PORT ?? "3200");
const apiBase = `http://localhost:${apiPort}`;
const extensionLabPath = join(import.meta.dirname, "../../../../extensions/extension-lab");

const bypassOnboarding = async (
  page: import("@playwright/test").Page,
  projectId: string,
  agentId = "pstdio.extension-lab.fake",
) => {
  await page.addInitScript(
    ({ currentProjectId, currentAgentId }: { currentProjectId: string; currentAgentId: string }) => {
      localStorage.setItem("onboarding-complete", "true");
      localStorage.setItem("selected-agent", currentAgentId);
      localStorage.setItem("dashboard-wb:selected-project:global", currentProjectId);
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

const fetchMetadata = async (request: import("@playwright/test").APIRequestContext, projectId: string) => {
  const response = await request.get(`${apiBase}/v1/projects/${projectId}/extensions/ui`);
  expect(response.ok()).toBe(true);
  return (await response.json()) as WorkbenchExtensionMetadata;
};

const openExtensionLab = async (page: import("@playwright/test").Page, projectId: string) => {
  await page.goto(`/projects/${projectId}`);
  await page.getByRole("option", { name: "Lab", exact: true }).click();
};

test.describe("Extension webviews", () => {
  test.beforeEach(async ({ request }) => {
    await deleteAllProjects(request);
  });
  test("loads managed webviews and routes host calls through the shell bridge", async ({ page, request }) => {
    const project = await createProject(request);

    await disableDefaultExtensionLab(request, project.id);
    await enableExtension(request, project.id, {
      displayName: "Extension Lab",
      extensionId: "pstdio.extension-lab",
      installName: "extension-lab-webviews",
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

    await openExtensionLab(page, project.id);
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

  test("creates an inbox notification from Extension Lab and opens it from the notifications modal", async ({
    page,
    request,
  }) => {
    const project = await createProject(request);

    await disableDefaultExtensionLab(request, project.id);
    await enableExtension(request, project.id, {
      displayName: "Extension Lab",
      extensionId: "pstdio.extension-lab",
      installName: "extension-lab-webviews",
      name: "extension-lab",
      sourcePath: extensionLabPath,
      version: "0.1.0",
    });

    await bypassOnboarding(page, project.id);

    await openExtensionLab(page, project.id);
    const labFrame = page.frameLocator('iframe[title="Lab"]');
    await expect(labFrame.getByRole("heading", { name: "Sandbox webview" })).toBeVisible();

    await labFrame.getByRole("button", { name: "Create inbox item" }).click();

    await page.getByRole("option", { name: /Notifications/ }).click();

    const notificationsModal = page.getByRole("dialog").filter({ has: page.getByPlaceholder("Search notifications") });
    await expect(notificationsModal).toBeVisible();
    await expect(notificationsModal.getByText("Review Extension Lab notification")).toBeVisible();
    await expect(notificationsModal.getByRole("button", { name: "Say hello" })).toBeVisible();

    await expect(page.getByRole("banner").getByRole("button", { name: /notifications/i })).toHaveCount(0);
  });

  test("opens host terminal tabs from the Extension Lab tree action", async ({ page, request }) => {
    const project = await createProject(request);
    const visibleTerminalText = async () => {
      const rows = page.locator(".xterm-rows");
      const text: string[] = [];
      for (let index = 0; index < (await rows.count()); index += 1) {
        const row = rows.nth(index);
        if (await row.isVisible()) text.push((await row.textContent()) ?? "");
      }
      return text.join("\n");
    };
    const expectVisibleTerminalOutput = async () => {
      await expect.poll(visibleTerminalText, { timeout: 2000 }).toMatch(/\S/);
      const text = await visibleTerminalText();
      expect(text).not.toContain("cannot set terminal process group");
      expect(text).not.toContain("no job control in this shell");
    };

    await disableDefaultExtensionLab(request, project.id);
    await enableExtension(request, project.id, {
      displayName: "Extension Lab",
      extensionId: "pstdio.extension-lab",
      installName: "extension-lab-host-terminal",
      name: "extension-lab",
      sourcePath: extensionLabPath,
      version: "0.1.0",
    });

    const metadata = await fetchMetadata(request, project.id);
    expect(metadata.routes.find((route) => route.path === "lab-terminal")).toBeUndefined();

    await bypassOnboarding(page, project.id);
    await page.goto(`/projects/${project.id}`);
    await page.getByRole("option", { name: "Open terminal", exact: true }).click();

    // Host terminal tabs are named after their foreground process (VSCode-style),
    // so identify the strip by its "New terminal" action and address tabs by position.
    const terminalTabList = page
      .getByRole("tablist")
      .filter({ has: page.getByRole("button", { name: "New terminal" }) });
    const terminalTabs = terminalTabList.getByRole("tab");

    await expect(terminalTabs).toHaveCount(1);
    await expect(terminalTabs.first()).toHaveAttribute("aria-selected", "true");
    await expect(terminalTabs.first()).toHaveAttribute("title", /^(bash|zsh|dash|sh)$/);
    await expectVisibleTerminalOutput();

    await terminalTabList.getByRole("button", { name: "New terminal" }).click();
    await expect(terminalTabs).toHaveCount(2);
    await expect(terminalTabs.nth(1)).toHaveAttribute("aria-selected", "true");
    await expectVisibleTerminalOutput();

    await terminalTabs.first().click();
    await expect(terminalTabs.first()).toHaveAttribute("aria-selected", "true");
    await expectVisibleTerminalOutput();

    await page.getByRole("separator", { name: "Resize Secondary Panel" }).press("Home");
    await expect(page.getByRole("button", { name: "Show Secondary Panel" })).toBeVisible();
    await page.getByRole("button", { name: "Show Secondary Panel" }).click();
    await expectVisibleTerminalOutput();

    // Close both terminals via the active tab's close button, then reopen one.
    await terminalTabs
      .first()
      .getByRole("button", { name: /^Close/ })
      .click();
    await terminalTabs
      .first()
      .getByRole("button", { name: /^Close/ })
      .click();
    await expect(page.getByRole("banner").getByRole("button", { name: "New terminal" })).toHaveCount(0);
    await page.getByRole("button", { name: "New terminal" }).click();
    await expect(terminalTabs).toHaveCount(1);
    await expectVisibleTerminalOutput();
  });
});
