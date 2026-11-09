import { expect, test } from "bun:test";
import { expect as browserExpect } from "@playwright/test";
import { withCloudProject } from "./packaged-cloud-project.fixture";
import { signInBrowser } from "./packaged-serve-helpers";
import { setupPackagedSmokeTests } from "./packaged-smoke-setup";
import { PACKAGED_TEST_TIMEOUT } from "./packaged-test-timeout";

setupPackagedSmokeTests();
// Critical: Cloud owns sync/setup progress and every recovery action without blocking navigation.
test(
  "Cloud retries failed downloads and folder preparation from its status details",
  async () => {
    let completeRetry = () => {};
    const retryHeld = new Promise<void>((resolve) => {
      completeRetry = resolve;
    });
    let completeInitialSetup = () => {};
    const initialSetupHeld = new Promise<void>((resolve) => {
      completeInitialSetup = resolve;
    });
    await withCloudProject("recovery", async ({ b, project, page, second, phase }) => {
      try {
        const opens: number[] = [];
        let downloaded = false;
        await page.route(`**/v1/account/projects/${project.id}/sync`, async (route) => {
          if (downloaded) return route.continue();
          await route.fulfill({
            contentType: "application/json",
            body: JSON.stringify({ state: "needs-attention", offlineReady: false }),
          });
        });
        await page.route(`**/v1/account/projects/${project.id}/retry`, (route) =>
          route.fulfill({
            status: 500,
            contentType: "application/json",
            body: JSON.stringify({ error: "The sync retry failed." }),
          }),
        );
        let attempts = 0;
        await page.route(`**/v1/projects/${project.id}/open`, async (route) => {
          if (++attempts === 1) {
            await initialSetupHeld;
            await route.fulfill({
              status: 500,
              contentType: "application/json",
              body: JSON.stringify({ error: "The project folder could not be created." }),
            });
            return;
          }
          await retryHeld;
          await route.continue();
        });
        page.on("response", (response) => {
          const path = new URL(response.url()).pathname;
          if (path === `/v1/projects/${project.id}/open`) opens.push(response.status());
          if (path.includes(project.id) && /\/(sync|retry|open|retry-setup)$/.test(path))
            console.info(`Cloud recovery response: ${response.request().method()} ${path} ${response.status()}`);
        });
        await signInBrowser(page, { origin: second.baseUrl, token: second.descriptor.token });
        await page
          .getByRole("dialog", { name: "Projects", exact: true })
          .getByRole("option", { name: "Cloud recovery", exact: true })
          .click();
        phase("project selected");
        const status = page.frameLocator('iframe[title="Prompt Studio Cloud"]').getByTestId("cloud-status-item");
        const details = page.frameLocator('iframe[title="Cloud details"]');
        await status.click();
        await details.getByRole("button", { name: "Retry", exact: true }).click();
        await browserExpect(details.getByText("The sync retry failed.", { exact: false })).toBeVisible();
        phase("sync retry failure checked; release download");
        downloaded = true;
        // Remount against the released status without starting another native synchronization.
        await page.reload();
        await browserExpect.poll(() => attempts).toBe(1);
        await browserExpect(status).toHaveText("Preparing project");
        phase("initial setup pending; release failure");
        completeInitialSetup();
        await browserExpect.poll(() => opens).toContain(500);
        await status.click();
        await details.getByRole("button", { name: "Retry", exact: true }).click();
        await browserExpect
          .poll(() => attempts)
          .toBe(2)
          .catch(async (error: unknown) => {
            console.error("Cloud recovery retry details:", await details.locator("body").innerText());
            throw error;
          });
        await browserExpect(status).toHaveText("Preparing project");
        phase("setup retry pending; release success");
        completeRetry();
        await browserExpect.poll(() => opens).toContain(200);
        expect((await b.projects.folder(project.id)).path).toBeTruthy();
        await browserExpect(status).toHaveText("Synced");
        await status.click();
        phase("project folder opened");
      } finally {
        completeInitialSetup();
        completeRetry();
      }
    });
  },
  PACKAGED_TEST_TIMEOUT,
);
