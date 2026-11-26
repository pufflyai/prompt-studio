import { expect, test } from "@playwright/test";
import { folderProjectInput } from "../helpers/folder-project";
import { uiOrigin } from "../ui-server";

test("Cloud status toggles and opens its app-wide settings with keyboard recovery", async ({ page, request }) => {
  // Critical: sign-in and account controls must remain reachable from the status item.
  const response = await request.post(`${uiOrigin}/v1/projects`, {
    data: folderProjectInput({ name: "Cloud settings" }),
  });
  expect(response.ok()).toBe(true);
  const project = await response.json();
  await page.addInitScript(() => localStorage.setItem("onboarding-complete", "true"));
  await page.goto(`/projects/${project.id}/`);
  const status = page.frameLocator('iframe[title="Prompt Studio Cloud"]');
  const detailsFrame = page.locator('iframe[title="Cloud details"]');
  const details = page.frameLocator('iframe[title="Cloud details"]');
  await expect(status.getByTestId("cloud-status-item")).toHaveText("Sign in");
  await page.locator("footer").getByRole("button", { name: "Prompt Studio Cloud", exact: true }).click();
  await expect(details.getByRole("button", { name: "Cloud settings" })).toBeVisible();
  await page.locator("footer").getByRole("button", { name: "Prompt Studio Cloud", exact: true }).click();
  await expect(detailsFrame).toBeHidden();
  await page.locator("footer").getByRole("button", { name: "Prompt Studio Cloud", exact: true }).click();
  await details.getByRole("button", { name: "Cloud settings" }).click();
  const settings = page.frameLocator('iframe[title="Cloud"]');
  const signIn = settings.getByRole("button", { name: "Sign in", exact: true });
  await expect(signIn).toBeVisible();
  await expect(settings.getByRole("button", { name: "Sign in with Google", exact: true })).toBeHidden();
  await signIn.click();
  const providers = settings.getByRole("dialog", { name: "Sign in" });
  await expect(providers).toBeVisible();
  await expect(providers.getByRole("button", { name: "Sign in with Google", exact: true })).toBeVisible();
  await expect(providers.getByRole("button", { name: "Sign in with Microsoft", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(providers).toBeHidden();
  await expect(signIn).toBeFocused();
  await expect(settings.getByText("Not signed in", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator('iframe[title="Cloud"]')).toBeHidden();
  await expect(status.getByTestId("cloud-status-item")).toBeVisible();
});
