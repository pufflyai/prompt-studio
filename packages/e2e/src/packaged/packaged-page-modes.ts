import { expect, type Page } from "@playwright/test";
import { writeNavigationExtension } from "./packaged-navigation-fixture";

export const withPageModeProbe = (extensions: string, root: string, enabled: boolean) => {
  if (!enabled) return extensions;
  const configured = JSON.parse(extensions);
  configured.defaultExtensions.push({
    source: writeNavigationExtension(root),
    installName: "navigation-probe",
    skipInstall: true,
  });
  return JSON.stringify(configured);
};

export const verifyPackagedPageModes = async (page: Page, origin: string, projectId: string) => {
  const home = new URL(`/projects/${projectId}/extensions/test.navigation-probe/home`, origin);
  const navigate = (url: string) =>
    page.evaluate((href) => {
      window.history.pushState(null, "", href);
      window.dispatchEvent(new PopStateEvent("popstate"));
    }, url);
  const breadcrumb = page.getByRole("navigation", { name: "breadcrumb" });
  const previous = (await breadcrumb.textContent()) ?? "";
  const invalid = new URL(home);
  invalid.searchParams.set("_mode", "project");
  await navigate(invalid.href);
  await expect(breadcrumb).toHaveText(previous);
  await navigate(home.href);
  await expect(breadcrumb.getByRole("link", { name: "Home", exact: true })).toBeVisible();
  const collectionContent = page.getByRole("main").locator("[data-workbench-instance]").filter({ visible: true });
  await expect(collectionContent).toHaveCount(1);
  const reviewHome = new URL(home);
  reviewHome.searchParams.set("_mode", "test.navigation-probe.mode.review");
  await navigate(reviewHome.href);
  await expect(collectionContent).toHaveCount(1);
  home.searchParams.set("_mode", "test.navigation-probe.mode.policy");
  await navigate(home.href);
  await expect(collectionContent).toHaveCount(1);
  const record = new URL(`/projects/${projectId}/extensions/test.navigation-probe/record`, origin);
  record.searchParams.set(
    "resource",
    `pstdio://extension-resource/record/record-1?extensionId=test.navigation-probe&projectId=${projectId}`,
  );
  record.searchParams.set("document", "file-1");
  record.searchParams.set("_mode", "project");
  await navigate(record.href);
  const main = page.locator('[data-workbench-panel-header="main"]');
  const tab = main.locator("[data-workbench-tab]");
  await expect(tab).toHaveCount(1);
  const instanceId = await tab.getAttribute("data-workbench-tab");
  await main.getByRole("button", { name: "Add panel", exact: true }).click();
  await expect(tab).toHaveAttribute("data-workbench-tab", instanceId!);
  await expect(page.getByRole("alert")).toHaveCount(0);
  const policyRecord = new URL(record);
  policyRecord.searchParams.set("_mode", "test.navigation-probe.mode.policy");
  await navigate(policyRecord.href);
  await expect(tab).toHaveCount(1);
  await navigate(record.href);
  await expect(tab).toHaveAttribute("data-workbench-tab", instanceId!);
  await tab.getByRole("tab").focus();
  await page.keyboard.press("Shift+F10");
  await page.getByRole("menuitem", { name: "Move to Side", exact: true }).click();
  const retained = page.locator(`[data-workbench-tab="${instanceId}"]`);
  await expect(retained).toBeVisible();
  await expect(breadcrumb).not.toContainText("Record");
  const collection = (await breadcrumb.textContent()) ?? "";
  const collectionUrl = page.url();
  await navigate(record.href);
  await expect(breadcrumb).toHaveText(collection);
  await expect(page).toHaveURL(collectionUrl);
  await expect(retained).toBeVisible();
  await expect(main.locator("[data-workbench-tab]")).toHaveCount(0);
  await expect(page.getByRole("alert")).toHaveCount(0);
  await retained.getByRole("tab").focus();
  await page.keyboard.press("Shift+F10");
  await page.getByRole("menuitem", { name: "Move to Main", exact: true }).click();
  await expect(main.locator(`[data-workbench-tab="${instanceId}"]`)).toBeVisible();
  await expect(breadcrumb).toContainText("record-1");
  await expect(page).toHaveURL(collectionUrl);
};
