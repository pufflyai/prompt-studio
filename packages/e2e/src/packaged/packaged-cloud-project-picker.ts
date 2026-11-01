import { join } from "node:path";
import { chromium, expect } from "@playwright/test";
import { logTestPhase } from "../scripts/log-test-phase";
import { PACKAGED_DASHBOARD_BROWSER } from "./packaged-chromium";
import { signInBrowser } from "./packaged-serve-helpers";

export const openCloudProjectInPicker = async (input: {
  baseUrl: string;
  token: string;
  projectId: string;
  name: string;
}) => {
  const browser = await chromium.launch(PACKAGED_DASHBOARD_BROWSER);
  logTestPhase("Cloud project opening: browser launched");
  try {
    const page = await browser.newPage();
    await page.addInitScript(() => {
      localStorage.setItem("onboarding-complete", "true");
      localStorage.removeItem("dashboard-wb2:selected-project:global");
    });
    await signInBrowser(page, { origin: input.baseUrl, token: input.token });
    logTestPhase("Cloud project opening: browser signed in");
    await page.screenshot({ path: join(import.meta.dir, "../../test-results/cloud-project-picker.png") });
    const picker = page.getByRole("dialog", { name: "Projects", exact: true });
    await expect(picker).toBeVisible();
    await picker.getByRole("option", { name: input.name, exact: true }).click();
    const opening = page.getByRole("dialog", { name: `Opening ${input.name}`, exact: true });
    await expect(opening).toBeVisible();
    await expect(opening.getByRole("status")).toContainText("Waiting for project content");
    await expect(opening.getByRole("button", { name: "Retry", exact: true })).toBeVisible();
    await page.screenshot({ path: join(import.meta.dir, "../../test-results/cloud-project-opening.png") });
    return {
      close: () => browser.close(),
      retry: async () => {
        const response = page.waitForResponse(
          (reply) => new URL(reply.url()).pathname === `/v1/account/projects/${input.projectId}/retry`,
        );
        await opening.getByRole("button", { name: "Retry", exact: true }).click();
        expect((await response).ok()).toBe(true);
      },
      ready: async () => {
        await expect(opening).toBeHidden();
        await expect(page).toHaveURL(new RegExp(`/projects/${input.projectId}(?:/|$)`));
      },
    };
  } catch (error) {
    console.error("Cloud project picker failed before cleanup:", error);
    await browser.close();
    throw error;
  }
};

export const reopenPreparedProjectOffline = async (input: { baseUrl: string; token: string; projectId: string }) => {
  const browser = await chromium.launch(PACKAGED_DASHBOARD_BROWSER);
  try {
    const page = await browser.newPage();
    await page.addInitScript((projectId) => {
      localStorage.setItem("onboarding-complete", "true");
      localStorage.setItem("dashboard-wb2:selected-project:global", projectId);
    }, input.projectId);
    await signInBrowser(page, { origin: input.baseUrl, token: input.token }, `/projects/${input.projectId}`);
    await expect(page.getByRole("main")).toBeVisible();
    await expect(page.getByRole("dialog", { name: /^Opening / })).toHaveCount(0);
    await page.screenshot({ path: join(import.meta.dir, "../../test-results/cloud-project-offline.png") });
  } finally {
    await browser.close();
  }
};
