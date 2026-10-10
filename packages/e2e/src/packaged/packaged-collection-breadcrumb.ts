import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, type Page } from "@playwright/test";

export const verifyPackagedCollectionBreadcrumb = async (
  page: Page,
  baseUrl: string,
  projectId: string,
  projectFolder: string,
  headers: Record<string, string>,
) => {
  const title = "Packaged collection breadcrumb";
  const fileName = "breadcrumb.html";
  const path = join(projectFolder, fileName);
  writeFileSync(path, `<html><head><title>${title}</title></head><body>Artifact preview</body></html>`);
  const response = await fetch(
    `${baseUrl}/v1/projects/${projectId}/extensions/commands/pstdio.pstdio-artifacts.command.publish/execute`,
    {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({ source: "api", params: { file_path: fileName } }),
    },
  );
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ outcome: { status: "success" } });
  await page.goto(`${baseUrl}/projects/${projectId}/extensions/pstdio.pstdio-artifacts/artifacts`);
  const libraryUrl = page.url();
  await page.frameLocator('iframe[title="Artifacts"]').getByText(title, { exact: true }).click();
  const breadcrumbs = page.getByRole("navigation", { name: "breadcrumb", exact: true });
  await expect(breadcrumbs.getByText("Artifacts", { exact: true })).toBeVisible();
  await expect(breadcrumbs.getByText(title, { exact: true })).toBeVisible();
  expect(page.url()).toBe(libraryUrl);
  await page.getByRole("button", { name: `Close ${title}`, exact: true }).click();
  await expect(breadcrumbs.getByText(title, { exact: true })).toHaveCount(0);
  await expect(breadcrumbs.getByText("Artifacts", { exact: true })).toBeVisible();
};
