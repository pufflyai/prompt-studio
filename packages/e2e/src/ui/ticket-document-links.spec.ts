import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { folderProjectInput } from "../helpers/folder-project";
import { createPlannerTicket, executePlannerCommand } from "../helpers/planner-api";
import { uiOrigin as apiBase } from "../ui-server";
import { prepareDashboard } from "./helpers/workspace-files";
import { createGitRepo } from "./helpers/workspace-session-attempt";

test("saved ticket document links survive copy, reload, history and rename", async ({
  page,
  request,
  context,
}, testInfo) => {
  const root = createGitRepo("pstdio-ticket-links-", "Workspace README");
  const created = await request.post(`${apiBase}/v1/projects`, {
    data: folderProjectInput({ name: "Saved document links" }, root),
  });
  expect(created.ok()).toBe(true);
  const project = await created.json();
  try {
    const ticket = await createPlannerTicket(request, apiBase, project.id, {
      content: "# Saved ticket body\nSaved body bytes",
    });
    const file = await executePlannerCommand<{ id: string }>(request, apiBase, project.id, "create-ticket-file", {
      ticketId: ticket.id,
      name: "research.md",
    });
    await executePlannerCommand(request, apiBase, project.id, "update-ticket-file", {
      ticketId: ticket.id,
      fileId: file.id,
      content: "# Saved research\nSaved research bytes",
    });
    const bodyLink = await executePlannerCommand<{ href: string }>(request, apiBase, project.id, "document-link", {
      id: ticket.shorthand,
    });
    const fileLink = await executePlannerCommand<{ href: string }>(request, apiBase, project.id, "document-link", {
      id: ticket.id,
      file: "research.md",
    });
    await prepareDashboard(page, project.id);
    await page.goto(bodyLink.href);
    await expect(page.getByText("Saved body bytes", { exact: false }).first()).toBeVisible();
    await page.getByRole("option", { name: "research.md", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`document=${file.id}`));
    await expect(page.getByText("Saved research bytes", { exact: false }).first()).toBeVisible();
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    const menu = page.frameLocator('iframe[title="Copy Link"]:visible');
    await menu.getByRole("button", { name: "Copy Link", exact: true }).click();
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toBe(new URL(fileLink.href, page.url()).href);
    await page.screenshot({ path: testInfo.outputPath("copy-link-attached.png") });
    await page.setViewportSize({ width: 500, height: 720 });
    await page.getByRole("button", { name: "Open Main left menu", exact: true }).click();
    await menu.getByRole("button", { name: "Copy Link", exact: true }).click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(copied);
    await page.screenshot({ path: testInfo.outputPath("copy-link-floating.png") });
    await page.keyboard.press("Escape");
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.reload();
    await expect(page.getByText("Saved research bytes", { exact: false }).first()).toBeVisible();
    await page.goBack();
    await expect(page.getByText("Saved body bytes", { exact: false }).first()).toBeVisible();
    await page.goForward();
    await expect(page.getByRole("option", { name: "research.md", exact: true })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await executePlannerCommand(request, apiBase, project.id, "update-ticket-file", {
      ticketId: ticket.id,
      fileId: file.id,
      name: "renamed.md",
    });
    await page.goto(copied);
    await expect(page.getByRole("option", { name: "renamed.md", exact: true })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(page.getByText("Saved research bytes", { exact: false }).first()).toBeVisible();
    await executePlannerCommand(request, apiBase, project.id, "delete-ticket-file", {
      ticketId: ticket.id,
      fileId: file.id,
    });
    await page.goto(copied);
    await expect(page.getByText(/Document unavailable/).first()).toBeVisible();
    await expect(page.getByText("Saved body bytes", { exact: false })).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath("unavailable-document.png") });

    mkdirSync(join(root, ".pstdio", "tickets", ticket.shorthand), { recursive: true });
    writeFileSync(join(root, ".pstdio", "tickets", ticket.shorthand, "ticket.md"), "Exact unsaved draft bytes");
    const [workspace] = await (await request.get(`${apiBase}/v1/workspaces?project_id=${project.id}`)).json();
    const session = await (
      await request.post(`${apiBase}/v1/sessions`, {
        data: {
          project_id: project.id,
          workspace_id: workspace.id,
          title: "Draft and saved links",
          agent: "pstdio.workbench-fixture.harness.fake",
          prompt: `[Draft](.pstdio/tickets/${ticket.shorthand}/ticket.md) and [Saved](${bodyLink.href})`,
        },
      })
    ).json();
    await page.goto(
      `/projects/${project.id}/session?resource=${encodeURIComponent(`pstdio://extension-resource/session/${session.id}`)}`,
    );
    await page.getByRole("link", { name: "Draft", exact: true }).last().click();
    await expect(page.locator(".monaco-editor .view-lines:visible")).toContainText(/Exact\s+unsaved\s+draft\s+bytes/);
    await page.goBack();
    await page.getByRole("link", { name: "Saved", exact: true }).last().click();
    await expect(page.getByText("Saved body bytes", { exact: false }).first()).toBeVisible();
  } finally {
    await request.delete(`${apiBase}/v1/projects/${project.id}`);
    rmSync(root, { recursive: true, force: true });
  }
});
