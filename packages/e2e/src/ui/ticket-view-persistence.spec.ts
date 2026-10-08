import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";
import { folderProjectInput } from "../helpers/folder-project";

test("shares saved ticket views while keeping active views local", async ({
  page,
  context,
  browser,
  request,
}, testInfo) => {
  const response = await request.post("/v1/projects", { data: folderProjectInput({ name: "Shared ticket views" }) });
  expect(response.ok()).toBe(true);
  const project = (await response.json()) as { id: string };
  const path = `/projects/${project.id}/extensions/pstdio.pstdio-planner/tickets`;
  const secondContext = await browser.newContext({ baseURL: new URL(response.url()).origin });
  const setup = (projectId: string) => {
    localStorage.setItem("onboarding-complete", "true");
    localStorage.setItem("dashboard-wb2:selected-project:global", projectId);
  };
  await context.addInitScript(setup, project.id);
  await secondContext.addInitScript(setup, project.id);
  const second = await secondContext.newPage();
  const boardPath = `/v1/projects/${project.id}/boards/pstdio.pstdio-planner.view.tickets/views`;
  try {
    await page.goto(path);
    await second.goto(path);
    await expect(second.getByRole("tab", { name: "All", exact: true })).toHaveAttribute("aria-selected", "true");
    await page.getByRole("button", { name: "Add view", exact: true }).click();
    const created = page.getByRole("tab", { name: "View 2", exact: true });
    await expect(created).toHaveAttribute("aria-selected", "true");
    await expect(second.getByRole("tab", { name: "View 2", exact: true })).toBeVisible();
    await expect(second.getByRole("tab", { name: "All", exact: true })).toHaveAttribute("aria-selected", "true");
    await created.click({ button: "right" });
    await page.getByRole("menuitem", { name: "Rename", exact: true }).click();
    await page.getByRole("textbox", { name: "View name" }).fill("Shared default");
    await page.getByRole("button", { name: "Rename", exact: true }).click();
    await expect(second.getByRole("tab", { name: "Shared default", exact: true })).toBeVisible();
    const listed = await (await request.get(boardPath)).json();
    const saved = listed.views.find((view: { title: string }) => view.title === "Shared default");
    const defaultResponse = await request.put(`${boardPath}/default`, { data: { viewId: saved.id } });
    expect(defaultResponse.ok(), await defaultResponse.text()).toBe(true);
    await expect.poll(async () => (await (await request.get(boardPath)).json()).defaultViewId).toBe(saved.id);
    await page.reload();
    await expect(page.getByRole("tab", { name: "Shared default", exact: true })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await second.evaluate(() => localStorage.clear());
    await second.reload();
    await expect(second.getByRole("tab", { name: "Shared default", exact: true })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await second.getByRole("button", { name: "Remove Ticket filter", exact: true }).click();
    await expect(second.getByRole("button", { name: "Save view", exact: true })).toBeVisible();
    const edited = await request.patch(`/v1/projects/${project.id}/board-views/${saved.id}`, {
      data: { title: "Agent edit" },
    });
    expect(edited.ok(), await edited.text()).toBe(true);
    await expect(second.getByRole("tab", { name: /^Agent edit/ })).toBeVisible();
    await expect(second.getByRole("button", { name: "Save view", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Save view", exact: true })).toHaveCount(0);
    await page.getByRole("tab", { name: /^Agent edit/ }).click({ button: "right" });
    await page.getByRole("menuitem", { name: "Delete view", exact: true }).click();
    for (const client of [page, second]) {
      await expect(client.getByRole("tab", { name: /^Agent edit/ })).toHaveCount(0);
      await expect(client.getByRole("tab", { name: "All", exact: true })).toHaveAttribute("aria-selected", "true");
    }
    await page.getByRole("tab", { name: "All", exact: true }).click({ button: "right" });
    await page.getByRole("menuitem", { name: "Rename", exact: true }).click();
    await page.getByRole("textbox", { name: "View name" }).fill("Everything");
    await page.getByRole("button", { name: "Rename", exact: true }).click();
    await expect(second.getByRole("tab", { name: "Everything", exact: true })).toBeVisible();
    await page.getByRole("tab", { name: "Everything", exact: true }).click({ button: "right" });
    await page.getByRole("menuitem", { name: "Duplicate", exact: true }).click();
    await expect(page.getByRole("tab", { name: "Everything copy", exact: true })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(second.getByRole("tab", { name: "Everything copy", exact: true })).toBeVisible();
    await page.getByRole("tab", { name: "Everything copy", exact: true }).click({ button: "right" });
    await page.getByRole("menuitem", { name: "Delete view", exact: true }).click();
    await expect(page.getByRole("tab", { name: "Everything copy", exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Remove Ticket filter", exact: true }).click();
    await page.getByRole("button", { name: "Save view", exact: true }).click();
    await expect(page.getByRole("tab", { name: "Everything", exact: true })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("button", { name: "Save view", exact: true })).toHaveCount(0);
    await second.reload();
    await second.getByRole("tab", { name: "Everything", exact: true }).click();
    await expect(second.getByRole("button", { name: "Remove Ticket filter", exact: true })).toHaveCount(0);
    const cli = spawnSync(
      "bun",
      [
        "--conditions=source",
        resolve(import.meta.dirname, "../../../pstdio/src/index.ts"),
        "views",
        "create",
        "--project-id",
        project.id,
        "--board",
        "pstdio.pstdio-planner.view.tickets",
        "--title",
        "Agent created",
        "--filter",
        "archived is-any-of Active",
      ],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          PSTDIO_DISABLE_EMBED_MANIFEST: "1",
          PSTDIO_HOME: process.env.E2E_HOME,
          PSTDIO_API_URL: new URL(response.url()).origin,
        },
      },
    );
    expect(cli.status, cli.stderr).toBe(0);
    const agentView = JSON.parse(cli.stdout);
    expect(agentView.filter).toEqual({
      conjunction: "and",
      rules: [{ attributeId: "archived", condition: "is-any-of", value: ["active"] }],
    });
    await expect(page.getByRole("tab", { name: "Agent created", exact: true })).toBeVisible();
    await expect(second.getByRole("tab", { name: "Agent created", exact: true })).toBeVisible();
    const execute = async (name: string, params: Record<string, unknown>) => {
      const result = await request.post(
        `/v1/projects/${project.id}/extensions/commands/pstdio.pstdio-planner.command.${name}/execute`,
        { data: { params } },
      );
      expect(result.ok(), await result.text()).toBe(true);
      const body = await result.json();
      expect(body.outcome.ok).toBe(true);
      return body.outcome.value;
    };
    const status = await execute("ticket-status.create", { label: "Temporary" });
    const filtered = await request.post(boardPath, {
      data: {
        title: "Temporary status",
        filter: { conjunction: "and", rules: [{ attributeId: "status", condition: "is-any-of", value: [status.id] }] },
      },
    });
    expect(filtered.ok(), await filtered.text()).toBe(true);
    for (const client of [page, second]) {
      await client.getByRole("tab", { name: "Temporary status", exact: true }).click();
      await expect(client.getByRole("button", { name: "Remove Status filter", exact: true })).toBeVisible();
    }
    await execute("ticket-status.delete", { statusId: status.id });
    for (const client of [page, second])
      await expect(client.getByRole("button", { name: "Remove Status filter", exact: true })).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath("shared-board-views.png") });
  } finally {
    await secondContext.close();
    await request.delete(`/v1/projects/${project.id}`);
  }
});
