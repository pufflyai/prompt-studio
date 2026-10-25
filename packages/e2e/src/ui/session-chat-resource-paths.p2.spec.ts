import { rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { folderProjectInput } from "../helpers/folder-project";
import { uiOrigin as apiBase } from "../ui-server";
import { prepareDashboard } from "./helpers/workspace-files";
import { createGitRepo } from "./helpers/workspace-session-attempt";

const agent = "pstdio.workbench-fixture.harness.fake";

test("opens note and artifact paths from chat in their own pages", async ({ page, request }) => {
  const root = createGitRepo("pstdio-chat-resource-paths-", "Chat resource paths");
  writeFileSync(join(root, "report.html"), "<title>Launch report</title><h1>Launch report</h1>");
  const created = await request.post(`${apiBase}/v1/projects`, {
    data: folderProjectInput({ name: "Chat resource paths", agents: [agent] }, root),
  });
  expect(created.ok()).toBe(true);
  const project = await created.json();
  const execute = async (command: string, params: Record<string, unknown>) => {
    const response = await request.post(`${apiBase}/v1/projects/${project.id}/extensions/commands/${command}/execute`, {
      data: { params, source: "api" },
    });
    const result = await response.json();
    expect(result.outcome.status, result.outcome.reason).toBe("success");
    return result.outcome.value;
  };
  try {
    const note = await execute("pstdio.pstdio-notes.command.notes.create", { title: "Launch plan" });
    const artifact = await execute("pstdio.pstdio-artifacts.command.publish", { file_path: "report.html" });
    const workspaces = await (await request.get(`${apiBase}/v1/workspaces?project_id=${project.id}`)).json();
    const response = await request.post(`${apiBase}/v1/sessions`, {
      data: {
        project_id: project.id,
        workspace_id: workspaces[0].id,
        title: "Resource path review",
        prompt: [
          `Read .pstdio/extension-storage/pstdio.pstdio-notes/documents/${note.id}/content.md`,
          `and .pstdio/extension-storage/pstdio.pstdio-artifacts/sites/${artifact.revisionId}.html`,
        ].join(" "),
        agent,
      },
    });
    expect(response.ok()).toBe(true);
    const session = await response.json();
    const sessionUrl = `/projects/${project.id}/session?resource=${encodeURIComponent(`pstdio://extension-resource/session/${session.id}`)}`;
    await prepareDashboard(page, project.id);

    // Read the bubbles inside the message so a sidebar item with the same name cannot match.
    const message = page.locator("p").filter({ hasText: /^Read / });
    await page.goto(sessionUrl);
    await expect(message.getByText("Launch plan", { exact: true })).toBeVisible();
    await message.getByText("Launch plan", { exact: true }).click();
    await expect(page).toHaveURL(/pstdio-notes/);
    await expect(page.getByRole("tab", { name: "Launch plan" })).toBeVisible();

    await page.goto(sessionUrl);
    await expect(message.getByText("Launch report", { exact: true })).toBeVisible();
    await message.getByText("Launch report", { exact: true }).click();
    await expect(page).toHaveURL(/pstdio-artifacts/);
    await expect(page.getByRole("tab", { name: "Launch report" })).toBeVisible();
  } finally {
    await request.delete(`${apiBase}/v1/projects/${project.id}`);
    rmSync(root, { recursive: true, force: true });
  }
});
