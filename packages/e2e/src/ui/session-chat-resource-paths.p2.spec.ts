import { rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { defaultPageResourceCodec } from "@pstdio/sdk/extensions";
import { folderProjectInput } from "../helpers/folder-project";
import { expect, test } from "../scripts/session-test";
import { uiOrigin as apiBase } from "../ui-server";
import { prepareDashboard } from "./helpers/workspace-files";
import { createGitRepo } from "./helpers/workspace-session-attempt";

const agent = "pstdio.workbench-fixture.harness.fake";

test("previews note and artifact paths from chat beside the conversation", async ({ page, request }) => {
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
    const note = await execute("pstdio.notes.command.notes.create", { title: "Launch plan" });
    const artifact = await execute("pstdio.artifacts.command.publish", { file_path: "report.html" });
    const workspaces = await (await request.get(`${apiBase}/v1/workspaces?project_id=${project.id}`)).json();
    const response = await request.post(`${apiBase}/v1/sessions`, {
      data: {
        project_id: project.id,
        workspace_id: workspaces[0].id,
        title: "Resource path review",
        prompt: [
          `Read .pstdio/extension-storage/pstdio.notes/documents/${note.id}/content.md`,
          `and .pstdio/extension-storage/pstdio.artifacts/sites/${artifact.revisionId}.html`,
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
    // Resource links preview in Side and keep this conversation open in Main.
    const sideHeader = page.locator('[data-workbench-panel-header="side"]');
    const mainBreadcrumb = page
      .locator('[data-workbench-panel-header="main"]')
      .getByRole("navigation", { name: "breadcrumb" });
    const expectConversationInMain = async () => {
      await expect(page).toHaveURL(
        (url) =>
          url.pathname === `/projects/${project.id}/session` &&
          defaultPageResourceCodec.fromUri(url.searchParams.get("resource") ?? "")?.id === session.id,
      );
      await expect(mainBreadcrumb).toContainText("Resource path review");
    };
    await message.getByText("Launch plan", { exact: true }).click();
    const noteTab = sideHeader.getByRole("tab", { name: "Launch plan", exact: true });
    await expect(noteTab).toHaveAttribute("aria-selected", "true");
    await expectConversationInMain();
    // The path resolved to the note: its preview offers the note's own actions.
    await noteTab.click({ button: "right" });
    await expect(page.getByRole("menuitem", { name: "Rename note", exact: true })).toBeVisible();
    await page.keyboard.press("Escape");

    await message.getByText("Launch report", { exact: true }).click();
    const artifactTab = sideHeader.getByRole("tab", { name: "Launch report", exact: true });
    await expect(artifactTab).toHaveAttribute("aria-selected", "true");
    // The unpinned artifact preview replaces the note preview.
    await expect(noteTab).toHaveCount(0);
    await expectConversationInMain();
    const preview = page
      .locator('[data-workbench-region="side"]')
      .frameLocator('iframe[title="Artifacts"]:visible')
      .last()
      .frameLocator('iframe[title^="Preview: "]')
      .frameLocator("iframe");
    await expect(preview.getByRole("heading", { name: "Launch report" })).toBeVisible();
    // The path resolved to the artifact: its preview offers the artifact's own actions.
    await artifactTab.click({ button: "right" });
    await expect(page.getByRole("menuitem", { name: "Rename artifact…", exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
  } finally {
    await request.delete(`${apiBase}/v1/projects/${project.id}`);
    rmSync(root, { recursive: true, force: true });
  }
});
