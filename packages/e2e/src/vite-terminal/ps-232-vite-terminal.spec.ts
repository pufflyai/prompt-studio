import { rmSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { createGitRepo, registerRepoViaApi } from "../ui/helpers/workspace-session-attempt";

const apiPort = Number(process.env.E2E_API_PORT ?? "3400");
const apiBase = `http://localhost:${apiPort}`;

const prepareDashboard = async (page: import("@playwright/test").Page, projectId: string) => {
  await page.addInitScript((selectedProjectId) => {
    localStorage.setItem("onboarding-complete", "true");
    localStorage.setItem("selected-agent", "pstdio.extension-lab.fake");
    localStorage.setItem("dashboard-wb:selected-project:global", selectedProjectId);
    localStorage.setItem(
      `dashboard-wb:last-resource:${selectedProjectId}`,
      JSON.stringify({
        kind: "dashboard-view",
        uri: "dashboard-workbench://dashboard-view/workspaces",
        id: "workspaces",
        label: "Workspaces",
        icon: "computer",
      }),
    );
  }, projectId);
};

const openWorkspaceTerminal = async (page: import("@playwright/test").Page, workspaceName: string) => {
  const workspaceRow = page.getByRole("option", { name: workspaceName, exact: true });
  await expect(workspaceRow).toBeVisible({ timeout: 30_000 });
  await workspaceRow.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Open terminal", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Terminal input" })).toBeFocused();
};

const runTerminalCommand = async (page: import("@playwright/test").Page, command: string, output: string) => {
  const terminalInput = page.getByRole("textbox", { name: "Terminal input" });
  await terminalInput.pressSequentially(command);
  await terminalInput.press("Enter");
  await expect(page.locator(".xterm:visible .xterm-rows")).toContainText(output);
};

test("PS-232 keeps HTTP same-origin and opens terminals through the runtime WebSocket endpoint", async ({
  baseURL,
  page,
  request,
}, testInfo) => {
  const projectResponse = await request.post(`${apiBase}/v1/projects`, {
    data: { name: `PS-232 Vite Terminal ${testInfo.project.name}` },
  });
  expect(projectResponse.ok()).toBe(true);
  const project = (await projectResponse.json()) as { id: string };
  const repoRoot = createGitRepo("pstdio-ps-232-", "vite terminal e2e");

  try {
    await registerRepoViaApi(request, apiBase, project.id, "ps-232-repo", repoRoot);
    const terminalSockets: import("@playwright/test").WebSocket[] = [];
    const apiRequestOrigins: string[] = [];
    page.on("websocket", (socket) => {
      if (new URL(socket.url()).pathname === "/v1/terminal") terminalSockets.push(socket);
    });
    page.on("request", (candidate) => {
      const url = new URL(candidate.url());
      if (url.pathname.startsWith("/v1")) apiRequestOrigins.push(url.origin);
    });

    await prepareDashboard(page, project.id);
    await page.goto(`/projects/${project.id}/workspaces`);

    await openWorkspaceTerminal(page, "ps-232-repo");
    expect(apiRequestOrigins).toContain(new URL(baseURL ?? "").origin);
    await runTerminalCommand(page, "echo __ps232_first_terminal__", "__ps232_first_terminal__");
    await runTerminalCommand(page, "exit", "exit");
    await expect.poll(() => terminalSockets[0]?.isClosed()).toBe(true);

    await page.reload();
    await openWorkspaceTerminal(page, "ps-232-repo");
    await runTerminalCommand(page, "echo __ps232_second_terminal__", "__ps232_second_terminal__");

    expect(terminalSockets.length).toBeGreaterThanOrEqual(2);
    expect(new Set(terminalSockets.map((socket) => socket.url()))).toEqual(
      new Set([`${apiBase.replace("http", "ws")}/v1/terminal`]),
    );
  } finally {
    await fetch(`${apiBase}/v1/projects/${project.id}`, { method: "DELETE" }).catch(() => undefined);
    rmSync(repoRoot, { recursive: true, force: true });
  }
});
