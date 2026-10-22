import { rmSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { folderProjectInput } from "../helpers/folder-project";
import { uiOrigin as apiBase } from "../ui-server";
import { prepareDashboard } from "./helpers/workspace-files";
import { createGitRepo } from "./helpers/workspace-session-attempt";

const ICON = `data:image/svg+xml;base64,${Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><circle cx="8" cy="8" r="8"/></svg>',
).toString("base64")}`;

test("shows site icons on chat web links and opens them in a new tab", async ({ page, request }) => {
  const root = createGitRepo("pstdio-chat-web-links-", "Workspace README\n");
  const project = await (
    await request.post(`${apiBase}/v1/projects`, {
      data: folderProjectInput({ name: "Chat web links", agents: ["pstdio.workbench-fixture.harness.fake"] }, root),
    })
  ).json();
  try {
    const [workspace] = await (await request.get(`${apiBase}/v1/workspaces?project_id=${project.id}`)).json();
    const session = await (
      await request.post(`${apiBase}/v1/sessions`, {
        data: {
          project_id: project.id,
          workspace_id: workspace.id,
          title: "Web link review",
          prompt:
            "Compare [Prompt Studio](https://github.com/pufflyai/prompt-studio) with https://no-icon.example.com/docs.",
          agent: "pstdio.workbench-fixture.harness.fake",
        },
      })
    ).json();
    // The runtime fetches real sites, so the test answers for it and for the linked site.
    const asked: string[] = [];
    await page.route("**/v1/link-icons?*", (route) => {
      const target = new URL(route.request().url()).searchParams.get("url")!;
      asked.push(target);
      return new URL(target).hostname === "github.com"
        ? route.fulfill({ json: { data_url: ICON } })
        : route.fulfill({ status: 404, json: { error: "No icon found." } });
    });
    await page
      .context()
      .route("https://github.com/**", (route) =>
        route.fulfill({ contentType: "text/html", body: "<title>Prompt Studio on GitHub</title>" }),
      );
    await prepareDashboard(page, project.id);
    await page.goto(
      `/projects/${project.id}/session?resource=${encodeURIComponent(`pstdio://extension-resource/session/${session.id}`)}`,
    );

    const link = page.getByRole("link", { name: "Prompt Studio", exact: true }).last();
    await expect(link).toHaveAttribute("href", "https://github.com/pufflyai/prompt-studio");
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("rel", "noopener noreferrer");
    await expect(link.locator("img")).toHaveAttribute("src", ICON);
    const fallback = page.getByRole("link", { name: "https://no-icon.example.com/docs", exact: true }).last();
    await expect(fallback.locator("svg.lucide-globe")).toBeVisible();
    expect(asked).toContain("https://github.com/pufflyai/prompt-studio");

    const opened = page.waitForEvent("popup");
    await link.click();
    const tab = await opened;
    await expect(tab).toHaveTitle("Prompt Studio on GitHub");
    // The native link opens the tab, so `rel="noopener"` keeps the site away from the dashboard window.
    expect(await tab.evaluate(() => window.opener === null)).toBe(true);
    expect(tab.url()).toBe("https://github.com/pufflyai/prompt-studio");
    await tab.close();
    expect(page.url()).toContain(`/projects/${project.id}/session`);
  } finally {
    await request.delete(`${apiBase}/v1/projects/${project.id}`);
    rmSync(root, { recursive: true, force: true });
  }
});
