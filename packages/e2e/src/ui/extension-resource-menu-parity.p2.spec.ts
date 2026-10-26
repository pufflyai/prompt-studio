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

test("Note actions share identity and rename the inactive subject across navigation, tabs, and breadcrumbs", async ({
  page,
  request,
}, testInfo) => {
  const root = mkdtempSync(join(tmpdir(), "note-resource-menu-"));
  try {
    const project = await createProject(request, root);
    const a = await execute(request, project.id, "notes", "notes.create", { title: "Keep this note selected" });
    const b = await execute(request, project.id, "notes", "notes.create", { title: "Rename this note" });
    await prepareResourceActionsDashboard(page, project.id);
    await page.goto(`/projects/${project.id}/extensions/pstdio.pstdio-notes/notes`);
    const nav = page.locator('[data-workbench-region="sidenav"]');
    const firstRow = nav.getByRole("option", { name: a.title, exact: true });
    if (!(await firstRow.isVisible())) await nav.getByRole("option", { name: "Notes", exact: true }).click();
    const secondRow = nav.getByRole("option", { name: b.title, exact: true });
    await secondRow.click();
    await firstRow.click();
    const route = page.url();
    await secondRow.click({ button: "right" });
    const expected = await menuValues(page, "Note");
    expect(expected).toHaveLength(2);
    await page.keyboard.press("Escape");
    await page.getByRole("tab", { name: b.title, exact: true }).click({ button: "right" });
    expect(await menuValues(page, "Note")).toEqual(expected);
    await page.getByRole("menuitem", { name: "Rename note", exact: true }).click();
    const title = page.getByRole("textbox", { name: "Title", exact: true });
    await expect(title).toHaveValue(b.title);
    await title.fill("Renamed from inactive tab");
    await page.getByRole("button", { name: "Run", exact: true }).click();
    await expect(nav.getByRole("option", { name: "Renamed from inactive tab", exact: true })).toBeVisible();
    await expect(page.getByRole("tab", { name: a.title, exact: true })).toHaveAttribute("aria-selected", "true");
    await expect(page).toHaveURL(route);
    await page.getByRole("tab", { name: "Renamed from inactive tab", exact: true }).click();
    await page.locator("[data-workbench-breadcrumb-resource-actions]").click();
    expect(await menuValues(page, "Note")).toEqual(expected);
    await page.screenshot({ path: testInfo.outputPath("note-menu-parity.png") });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Artifact actions keep rename defaults, target inactive tabs, and refresh through owner events", async ({
  page,
  request,
}, testInfo) => {
  const root = mkdtempSync(join(tmpdir(), "artifact-resource-menu-"));
  try {
    writeFileSync(join(root, "a.html"), "<title>Artifact A</title><p>A</p>");
    writeFileSync(join(root, "b.html"), "<title>Artifact B</title><p>B</p>");
    const project = await createProject(request, root);
    const a = await execute(request, project.id, "artifacts", "publish", { file_path: "a.html" });
    const b = await execute(request, project.id, "artifacts", "publish", { file_path: "b.html" });
    await prepareResourceActionsDashboard(page, project.id);
    await page.goto(a.url);
    await expect(page.getByRole("tab", { name: "Artifact A", exact: true })).toBeVisible();
    await page.goto(b.url);
    // Published URLs open their viewer after the page has loaded.
    const secondTab = page.getByRole("tab", { name: "Artifact B", exact: true });
    await expect(secondTab).toHaveAttribute("aria-selected", "true");
    const firstTab = page.getByRole("tab", { name: "Artifact A", exact: true });
    await firstTab.click();
    await expect(firstTab).toHaveAttribute("aria-selected", "true");
    const route = page.url();
    await secondTab.click({ button: "right" });
    const expected = await menuValues(page, "Artifact");
    expect(expected).toHaveLength(2);
    await page.getByRole("menuitem", { name: "Rename artifact…", exact: true }).click();
    const name = page.getByRole("textbox", { name: "Artifact name", exact: true });
    await expect(name).toHaveValue("Artifact B");
    await name.fill("Artifact B renamed");
    await page.getByRole("button", { name: "Run", exact: true }).click();
    const renamed = page.getByRole("tab", { name: "Artifact B renamed", exact: true });
    await expect(renamed).toBeVisible();
    await expect(firstTab).toHaveAttribute("aria-selected", "true");
    await expect(page).toHaveURL(route);
    await renamed.click();
    await page.locator("[data-workbench-breadcrumb-resource-actions]").click();
    expect(await menuValues(page, "Artifact")).toEqual(expected);
    await page.screenshot({ path: testInfo.outputPath("artifact-menu-parity.png") });
    await page.keyboard.press("Escape");
    await execute(request, project.id, "artifacts", "rename-resource", {
      artifactId: b.artifactId,
      name: "Owner update",
    });
    await expect(page.getByRole("navigation", { name: "breadcrumb" })).toContainText("Owner update");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
