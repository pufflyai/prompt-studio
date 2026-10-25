import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type APIRequestContext, expect, type Page, test } from "@playwright/test";
import { folderProjectInput } from "../helpers/folder-project";
import { prepareResourceActionsDashboard } from "./helpers/resource-actions";

const execute = async (
  request: APIRequestContext,
  projectId: string,
  owner: string,
  command: string,
  params: Record<string, string>,
) => {
  const response = await request.post(
    `/v1/projects/${projectId}/extensions/commands/pstdio.pstdio-${owner}.command.${command}/execute`,
    {
      data: { params, source: "api" },
    },
  );
  expect(response.ok()).toBe(true);
  const result = await response.json();
  expect(result.outcome.status).toBe("success");
  return result.outcome.value;
};
const createProject = async (request: APIRequestContext, root: string) => {
  const response = await request.post("/v1/projects", {
    data: folderProjectInput({ name: "Resource menu parity" }, root),
  });
  expect(response.ok()).toBe(true);
  return (await response.json()) as { id: string };
};
const menuValues = (page: Page, name: string) =>
  page
    .getByRole("group", { name, exact: true })
    .getByRole("menuitem")
    .evaluateAll((nodes) => nodes.map((node) => ({ id: node.getAttribute("data-value"), label: node.textContent })));
const dump = async (page: Page, label: string) =>
  console.log(label, await page.evaluate(() => {
    const w = (window as any).__pstdioDashboardWorkbench;
    const layout = w.layout.getLayout();
    return JSON.stringify({
      page: w.pages.store.getState().activePageId,
      active: layout.regions.main.activeWidgetId?.slice(-30),
      main: layout.regions.main.widgets.map((x: any) => [x.title, x.role, x.placementIdentity?.pageId?.split(".").at(-1), x.placementIdentity?.slotId, x.ownerResourceKey ? "owned" : ""]),
    });
  }), JSON.stringify(await page.locator('[data-workbench-panel-header="main"]').getByRole("tab").allTextContents()));

test("repro: artifact rename", async ({ page, request }) => {
  const root = mkdtempSync(join(tmpdir(), "artifact-repro-"));
  writeFileSync(join(root, "a.html"), "<title>Artifact A</title><p>A</p>");
  writeFileSync(join(root, "b.html"), "<title>Artifact B</title><p>B</p>");
  const project = await createProject(request, root);
  const a = await execute(request, project.id, "artifacts", "publish", { file_path: "a.html" });
  const b = await execute(request, project.id, "artifacts", "publish", { file_path: "b.html" });
  await prepareResourceActionsDashboard(page, project.id);
  await page.goto(a.url);
  await expect(page.getByRole("tab", { name: "Artifact A", exact: true })).toBeVisible();
  await dump(page, "A");
  await page.goto(b.url);
  await page.waitForTimeout(2000);
  await dump(page, "B");
  await page.getByRole("tab", { name: "Artifact A", exact: true }).click();
  await page.waitForTimeout(500);
  await dump(page, "clickA");
  await page.getByRole("tab", { name: "Artifact B", exact: true }).click({ button: "right" });
  await page.getByRole("menuitem", { name: "Rename artifact…", exact: true }).click();
  await page.getByRole("textbox", { name: "Artifact name", exact: true }).fill("Artifact B renamed");
  await page.getByRole("button", { name: "Run", exact: true }).click();
  await page.waitForTimeout(2000);
  await dump(page, "renamed");
  rmSync(root, { recursive: true, force: true });
});
