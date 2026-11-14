import { folderProjectInput } from "../helpers/folder-project";
import { expect, test } from "../scripts/session-test";

test("opens a preinstalled skill browser with a selected skill and preserves files across panel changes", async ({
  page,
  request,
}) => {
  // Critical: automatic selection and closing details must keep instructions and supporting files accessible.
  const created = await request.post("/v1/projects", { data: folderProjectInput({ name: "Skill browser" }) });
  expect(created.status()).toBe(201);
  const project = (await created.json()) as { id: string };
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
  const viewer = page.frameLocator('iframe[title="Skills"]:visible');
  await expect(viewer.getByTestId("project-skill-metadata")).toContainText(first.name);
  await page.getByRole("option", { name: skill.title, exact: true }).click();
  await expect(viewer.getByTestId("project-skill-metadata")).toContainText(skill.name);
  await viewer.getByText("pages.md", { exact: true }).click();
  const document = viewer.getByTestId("project-skill-editor-scroll");
  await expect(document).toContainText("Pages and panels");
  const divider = viewer.getByRole("separator", { name: "Resize skill details" });
  const original = Number(await divider.getAttribute("aria-valuenow"));
  await divider.focus();
  await divider.press("ArrowRight");
  await expect.poll(async () => Number(await divider.getAttribute("aria-valuenow"))).toBeGreaterThan(original);
  await viewer.getByRole("button", { name: "Close skill details", exact: true }).click();
  await expect(viewer.getByTestId("project-skill-file-tree")).toBeHidden();
  await expect(document).toContainText("Pages and panels");
  await viewer.getByRole("button", { name: "Show skill details", exact: true }).click();
  await expect(viewer.getByTestId("project-skill-file-tree")).toBeVisible();
  await expect(document).toContainText("Pages and panels");
  await viewer.getByRole("button", { name: "Info", exact: true }).click();
  await expect(viewer.getByTestId("project-skill-metadata")).toBeHidden();
  await expect(viewer.getByTestId("project-skill-file-tree")).toBeVisible();
  await page.reload();
  await expect(viewer.getByTestId("project-skill-metadata")).toContainText(skill.name);
  await page.getByRole("option", { name: "Settings", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("dialog").getByText("Runtime", { exact: true }).last()).toBeVisible();
});
