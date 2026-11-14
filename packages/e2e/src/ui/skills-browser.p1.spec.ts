import { readFileSync } from "node:fs";
import { join } from "node:path";
import { e2eExtension } from "../default-extensions";
import { folderProjectInput } from "../helpers/folder-project";
import { expect, test } from "../scripts/session-test";

test("opens an installed skill browser with native menus and preserves files across panel changes", async ({
  page,
  request,
}) => {
  // Critical: automatic selection and closing details must keep instructions and supporting files accessible.
  const created = await request.post("/v1/projects", { data: folderProjectInput({ name: "Skill browser" }) });
  expect(created.status()).toBe(201);
  const project = (await created.json()) as { id: string };
  const source = e2eExtension("pstdio-skill-browser").source;
  const manifest = JSON.parse(readFileSync(join(source, "package.json"), "utf8"));
  const installed = await request.post(`/v1/projects/${project.id}/extensions/installed/pstdio-skill-browser/enable`, {
    data: {
      displayName: manifest.displayName,
      extensionId: "pstdio.pstdio-skill-browser",
      manifest,
      name: manifest.name,
      sourceHash: "skill-browser",
      sourceKind: "local_path",
      sourcePath: source,
      sourceRef: null,
      version: manifest.version,
    },
  });
  expect(installed.ok(), await installed.text()).toBe(true);
  const listed = await request.get(`/v1/projects/${project.id}/skills`);
  expect(listed.ok()).toBe(true);
  const skills = (await listed.json()) as { name: string; title: string }[];
  const first = skills[0]!;
  const skill = skills.find((item) => item.name === "create-pstdio-extension")!;
  expect(skill).toBeTruthy();
  await page.goto(`/projects/${project.id}`);
  await expect(page.getByRole("option", { name: "Skills", exact: true })).toBeVisible();
  await expect(page.getByRole("option", { name: "Settings", exact: true })).toBeVisible();
  const footer = page.getByRole("listbox").last();
  const labels = await footer.getByRole("option").allTextContents();
  expect(labels.indexOf("Skills")).toBeLessThan(labels.indexOf("Settings"));
  await page.getByRole("option", { name: "Skills", exact: true }).click();
  await expect(page).toHaveURL(/extensions\/pstdio.pstdio-skill-browser\/skill\?/);
  const menu = page.locator('[data-workbench-panel-menu="main-right"]');
  await expect(menu).toContainText(first.name);
  await page.getByRole("option", { name: skill.title, exact: true }).click();
  await expect(menu).toContainText(skill.name);
  await menu.getByText("references", { exact: true }).click();
  await menu.getByText("pages.md", { exact: true }).click();
  const document = page.getByRole("region", { name: "Main", exact: true });
  await expect(document).toContainText("Pages and panels");
  const divider = page.getByRole("separator", { name: "Resize Main right menu" });
  const original = Number(await divider.getAttribute("aria-valuenow"));
  await divider.focus();
  await divider.press("ArrowLeft");
  await expect.poll(async () => Number(await divider.getAttribute("aria-valuenow"))).toBeGreaterThan(original);
  await divider.press("Home");
  await expect(menu).toBeHidden();
  await expect(document).toContainText("Pages and panels");
  await page.getByRole("button", { name: "Open Main right menu", exact: true }).click();
  await expect(menu).toBeVisible();
  await expect(document).toContainText("Pages and panels");
  await menu.getByText("Info", { exact: true }).click();
  await expect(menu.getByText(skill.name, { exact: true })).toBeHidden();
  await expect(menu.getByText("pages.md", { exact: true })).toBeVisible();
  await page.reload();
  await expect(document).toContainText("Pages and panels");
  await page.getByRole("option", { name: "Settings", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("dialog").getByText("Runtime", { exact: true }).last()).toBeVisible();
});
