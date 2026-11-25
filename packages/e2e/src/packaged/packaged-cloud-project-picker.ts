import { join } from "node:path";
import { type Browser, chromium, expect } from "@playwright/test";
import { logTestPhase } from "../scripts/log-test-phase";
import { PACKAGED_DASHBOARD_BROWSER } from "./packaged-chromium";
import { signInBrowser } from "./packaged-serve-helpers";

export const openCloudProjectInPicker = async (input: {
  browser: Browser;
  baseUrl: string;
  token: string;
  projectId: string;
  name: string;
}) => {
  const { browser } = input;
  try {
    const page = await browser.newPage();
    await page.addInitScript(() => {
      if (window !== window.top) return;
      localStorage.setItem("onboarding-complete", "true");
      localStorage.removeItem("dashboard-wb2:selected-project:global");
    });
    await signInBrowser(page, { origin: input.baseUrl, token: input.token });
    logTestPhase("Cloud project opening: browser signed in");
    await page.screenshot({ path: join(import.meta.dir, "../../test-results/cloud-project-picker.png") });
    const picker = page.getByRole("dialog", { name: "Projects", exact: true });
    await expect(picker).toBeVisible();
    await picker.getByRole("option", { name: input.name, exact: true }).click();
    await expect(picker).toBeHidden();
    const status = page.frameLocator('iframe[title="Prompt Studio Cloud"]').getByTestId("cloud-status-item");
    const details = page.frameLocator('iframe[title="Cloud details"]');
    // Reads are rejected before any asset transfer starts: expose the pending source truthfully.
    await expect(status).toHaveText("Waiting to sync");
    await page.locator("footer").getByRole("button", { name: "Prompt Studio Cloud", exact: true }).click();
    await expect(details.getByText("No files are downloading.", { exact: false })).toBeVisible();
    await expect(details.getByRole("button", { name: "Retry", exact: true })).toBeVisible();
    await page.screenshot({ path: join(import.meta.dir, "../../test-results/cloud-project-opening.png") });
    return {
      close: () => browser.close(),
      retry: async (restorePeer: () => void) => {
        const retryUrl = new URL(`/v1/account/projects/${input.projectId}/retry`, input.baseUrl).href;
        await page.route(
          retryUrl,
          async (route) => {
            if (route.request().method() === "POST") restorePeer();
            await route.continue();
          },
          { times: 1 },
        );
        const [response] = await Promise.all([
          page.waitForResponse((reply) => reply.url() === retryUrl && reply.request().method() === "POST"),
          details.getByRole("button", { name: "Retry", exact: true }).click(),
        ]);
        expect(response.ok()).toBe(true);
      },
      ready: async () => {
        await expect(status).toHaveText("Synced");
        await expect(page).toHaveURL(new RegExp(`/projects/${input.projectId}(?:/|$)`));
      },
    };
  } catch (error) {
    console.error("Cloud project picker failed before cleanup:", error);
    await browser.close();
    throw error;
  }
};

export const reopenPreparedProjectOffline = async (
  restart: () => Promise<{ baseUrl: string; token: string; projectId: string }>,
) => {
  const [device, launched] = await Promise.allSettled([restart(), chromium.launch(PACKAGED_DASHBOARD_BROWSER)]);
  if (device.status === "rejected" || launched.status === "rejected") {
    const cleanup = await Promise.allSettled([launched.status === "fulfilled" ? launched.value.close() : undefined]);
    throw new AggregateError(
      [device, launched, ...cleanup].flatMap((result) => (result.status === "rejected" ? [result.reason] : [])),
      "Could not restart the offline device and browser",
    );
  }
  logTestPhase("Cloud project opening: offline host and cold browser ready");
  const input = device.value;
  const browser = launched.value;
  try {
    const page = await browser.newPage();
    await page.addInitScript((projectId) => {
      if (window !== window.top) return;
      localStorage.setItem("onboarding-complete", "true");
      localStorage.setItem("dashboard-wb2:selected-project:global", projectId);
    }, input.projectId);
    await signInBrowser(page, { origin: input.baseUrl, token: input.token }, `/projects/${input.projectId}`);
    logTestPhase("Cloud project opening: offline browser signed in");
    await expect(page.getByRole("main")).toBeVisible();
    await expect(page.getByRole("dialog", { name: /^Opening / })).toHaveCount(0);
    await page.screenshot({ path: join(import.meta.dir, "../../test-results/cloud-project-offline.png") });
  } finally {
    await browser.close();
  }
};
