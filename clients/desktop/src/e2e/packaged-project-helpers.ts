import { expect, type Page } from "@playwright/test";

export const openPackagedProject = async (page: Page, name: string) => {
  const picker = page.getByRole("dialog").filter({ has: page.getByPlaceholder("Search projects...") });
  if (!(await picker.isVisible())) await page.getByRole("button", { name: "Open project", exact: true }).click();
  await picker.getByText(name, { exact: true }).click();
  await expect(page.getByRole("tab", { name, exact: true })).toHaveAttribute("aria-selected", "true");
};

export const createPackagedProject = async (page: Page, name: string) => {
  const result = await page.evaluate(async (projectName) => {
    const response = await fetch("/v1/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: projectName }),
    });
    return { status: response.status, project: (await response.json()) as { id: string; name: string } };
  }, name);
  expect(result.status).toBe(201);
  return result.project;
};

export const dragProjectTab = async (page: Page, name: string, targetName: string) => {
  const source = page.getByRole("tab", { name, exact: true });
  const target = page.getByRole("tab", { name: targetName, exact: true });
  await source.scrollIntoViewIfNeeded();
  const from = (await source.boundingBox())!;
  const to = (await target.boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 12 });
  await page.mouse.up();
};
