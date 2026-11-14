import { folderProjectInput } from "../helpers/folder-project";
import { expect, test } from "../scripts/session-test";

test("opens skill instructions and supporting files from the navigation footer", async ({ page, request }) => {
  // Critical: moving this tool must preserve access to instructions and nested files.
  const created = await request.post("/v1/projects", { data: folderProjectInput({ name: "Skill browser" }) });
  expect(created.status()).toBe(201);
  const project = (await created.json()) as { id: string };
  const listed = await request.get(`/v1/projects/${project.id}/skills`);
  expect(listed.ok()).toBe(true);
  const skills = (await listed.json()) as { name: string; title: string }[];
  const skill = skills.find((item) => item.name === "create-pstdio-extension")!;
  expect(skill).toBeTruthy();
  await page.goto(`/projects/${project.id}`);
  await page.getByRole("option", { name: "Skills", exact: true }).click();
  await expect(page).toHaveURL(/extensions\/pstdio.pstdio-skills\/skills$/);
  await page.getByRole("option", { name: skill.title, exact: true }).click();
  const viewer = page.frameLocator('iframe[title="Skills"]:visible');
  await expect(viewer.getByTestId("project-skill-metadata")).toContainText("create-pstdio-extension");
  await viewer.getByRole("tab", { name: "Files", exact: true }).click();
  await viewer.getByText("pages.md", { exact: true }).click();
  await expect(viewer.getByTestId("project-skill-editor-scroll")).toContainText("Pages and panels");
  await page.reload();
  await expect(viewer.getByTestId("project-skill-metadata")).toContainText("create-pstdio-extension");
  await page.getByRole("option", { name: "Settings", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("dialog").getByText("Runtime", { exact: true }).last()).toBeVisible();
});
