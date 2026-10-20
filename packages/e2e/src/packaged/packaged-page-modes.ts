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
};
