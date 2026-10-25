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
  const result = await response.json();
  expect(result, JSON.stringify(result)).toMatchObject({ outcome: { status: "success" } });
  await page.goto(`${baseUrl}/projects/${projectId}/extensions/pstdio.pstdio-artifacts/artifacts`);
  const libraryUrl = page.url();
  await page.frameLocator('iframe[title="Artifacts"]').getByText(title, { exact: true }).click();
  const breadcrumbs = page.getByRole("navigation", { name: "breadcrumb", exact: true });
  await expect(breadcrumbs.getByText("Artifacts", { exact: true })).toBeVisible();
  await expect(breadcrumbs.getByText(title, { exact: true })).toBeVisible();
  expect(page.url()).toBe(libraryUrl);
  const tab = (region: string) =>
    page.locator(`[data-workbench-panel-header="${region}"]`).getByRole("tab", { name: title, exact: true });
  await tab("main").focus();
  await page.keyboard.press("Shift+F10");
  await page.getByRole("menuitem", { name: "Move to Secondary", exact: true }).click();
  await expect(tab("secondary")).toBeVisible();
  const sidenav = page.locator('[data-workbench-region="sidenav"]');
  const home = await sidenav.getByRole("option", { name: "Home", exact: true }).boundingBox();
  const sessionsEntry = await sidenav.getByRole("option", { name: "Sessions", exact: true }).boundingBox();
  expect(home!.y + home!.height).toBeLessThanOrEqual(sessionsEntry!.y);
  const searchBefore = await sidenav.getByRole("option", { name: "Search", exact: true }).elementHandle();
  const sessions = new URL(libraryUrl);
  sessions.pathname = `/projects/${projectId}/sessions`;
  await page.evaluate((url) => {
    history.pushState(null, "", url);
    dispatchEvent(new PopStateEvent("popstate"));
  }, sessions.href);
  await expect(breadcrumbs).toContainText("Sessions");
  expect(await searchBefore!.evaluate((row) => row.isConnected)).toBe(true);
  const modeReturn = sidenav.getByRole("button", { name: "Back to project", exact: true });
  await expect(modeReturn).toBeVisible();
  expect(await modeReturn.evaluate((button) => button.closest('[draggable="true"]'))).toBeNull();
  expect(
    await modeReturn.evaluate((button) => {
      const navigation = button.closest("section");
      return navigation?.querySelector('[data-scope="scroll-area"][data-part="viewport"]')?.contains(button);
    }),
  ).toBe(true);
  const search = await sidenav.getByRole("option", { name: "Search", exact: true }).boundingBox();
  const back = await modeReturn.boundingBox();
  expect(back!.y).toBeGreaterThanOrEqual(search!.y + search!.height);
  const returningRows = page.evaluate(
    () =>
      new Promise<Array<{ home: number | null; sessions: number | null }>>((resolve) => {
        const frames: Array<{ home: number | null; sessions: number | null }> = [];
        const sample = () => {
          const nav = document.querySelector('[data-workbench-region="sidenav"]')!;
          const leaving = [...nav.querySelectorAll('[role="button"]')].some(
            (row) => row.textContent?.trim() === "Back to project",
          );
          if (!leaving) {
            const rows = [...nav.querySelectorAll('[role="option"]')];
            const top = (label: string) =>
              rows.find((row) => row.textContent?.trim() === label)?.getBoundingClientRect().top ?? null;
            frames.push({ home: top("Home"), sessions: top("Sessions") });
          }
          if (frames.length === 12) resolve(frames);
          else requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
      }),
  );
  await modeReturn.click();
  for (const frame of await returningRows) expect(frame).toEqual({ home: home!.y, sessions: sessionsEntry!.y });
  await expect(page).toHaveURL(libraryUrl);
  await expect(modeReturn).toHaveCount(0);
  await page.goBack();
  await expect(modeReturn).toBeVisible();
  await page.goBack();
  await expect(tab("secondary")).toBeVisible();
  await expect(tab("main")).toHaveCount(0);
  await page.reload();
  await expect(tab("secondary")).toBeVisible();
  await page.getByRole("button", { name: `Close ${title}`, exact: true }).click();
  await expect(breadcrumbs.getByText(title, { exact: true })).toHaveCount(0);
  await expect(breadcrumbs.getByText("Artifacts", { exact: true })).toBeVisible();
};
