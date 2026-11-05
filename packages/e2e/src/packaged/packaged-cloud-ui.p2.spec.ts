import type { ChildProcess } from "node:child_process";
import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { folderProjectInput } from "../helpers/folder-project";
import { stopPendingTestProcesses } from "../scripts/pending-test-processes";
import { type Browser, test as base, chromium, expect } from "../scripts/playwright-test";
import { PACKAGED_DASHBOARD_BROWSER } from "./packaged-chromium";
import { createCloudAcceptanceFixture, signInCloudAcceptanceDevice } from "./packaged-cloud-acceptance.fixture";
import { buildBinary } from "./packaged-helpers";
import { signInBrowser, stopProcess } from "./packaged-serve-helpers";

interface Resources {
  root: string;
  children: Set<ChildProcess>;
  fixture?: Awaited<ReturnType<typeof createCloudAcceptanceFixture>>;
  browser?: Browser;
}
const test = base.extend<{ resources: Resources }>({
  // biome-ignore lint/correctness/noEmptyPattern: Playwright reads fixture dependency patterns.
  resources: async ({}, use) => {
    const resources: Resources = {
      root: realpathSync(mkdtempSync(join(tmpdir(), "pstdio-cloud-ui-"))),
      children: new Set(),
    };
    const failures: unknown[] = [];
    try {
      await use(resources);
    } catch (cause) {
      failures.push(cause);
    }
    await stopPendingTestProcesses().catch((cause) => failures.push(cause));
    const stopped = await Promise.allSettled([
      resources.browser?.close(),
      ...[...resources.children].map(stopProcess),
      resources.fixture?.peer.close(),
    ]);
    for (const result of stopped) if (result.status === "rejected") failures.push(result.reason);
    try {
      rmSync(resources.root, { recursive: true, force: true });
    } catch (cause) {
      failures.push(cause);
    }
    if (failures.length) throw new AggregateError(failures, "Cloud UI scenario or cleanup failed");
  },
});
test.beforeAll(() => buildBinary());

// Controlled-peer qualification of the production extension. Real Google and deployed services remain PS-789.
test("Cloud settings respect early access and manage devices and project sync through the real bridge", async ({
  resources,
}) => {
  // Critical: a denied account must not gain Cloud controls; make-local must preserve both devices' copies.
  const fixture = await createCloudAcceptanceFixture(resources.root, resources.children, { cloudUi: true });
  resources.fixture = fixture;
  await fixture.peer.setEarlyAccess(false);
  const first = await fixture.start("first");
  const project = await first.client.projects.create(folderProjectInput({ name: "Cloud UI acceptance" }, first.folder));
  const browser = await chromium.launch({ headless: true, ...PACKAGED_DASHBOARD_BROWSER });
  resources.browser = browser;
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  await context.addInitScript(() => localStorage.setItem("onboarding-complete", "true"));
  const page = await context.newPage();
  await signInBrowser(page, first.host.descriptor, `/projects/${project.id}/`);
  const status = page.frameLocator('iframe[title="Prompt Studio Cloud"]').getByTestId("cloud-status-item");
  const details = page.frameLocator('iframe[title="Cloud details"]');
  const settings = page.frameLocator('iframe[title="Cloud"]');
  await expect(status).toHaveText("Sign in");
  await status.click();
  await details.getByRole("button", { name: "Cloud settings" }).click();
  const startSignIn = async () => {
    const opened = context.waitForEvent("page");
    const destination = context.waitForEvent(
      "request",
      (request) => new URL(request.url()).pathname === "/v1/native-login",
    );
    await settings.getByRole("button", { name: "Sign in", exact: true }).click();
    const popup = await opened;
    const login = new URL((await destination).url());
    expect(login.origin).toBe(fixture.peer.origin);
    await expect.poll(() => new URL(popup.url()).pathname).toBe("/v1/native-login");
    await popup.close();
    const callback = new URL(login.searchParams.get("callback")!);
    callback.searchParams.set("state", login.searchParams.get("state")!);
    callback.searchParams.set("code", "controlled-fixture-login");
    return callback;
  };
  // Actual UI initiation and cancellation share the native request even after the view is reopened.
  const cancelled = await startSignIn();
  await expect(settings.getByRole("button", { name: "Cancel sign-in" })).toBeVisible();
  await settings.getByRole("button", { name: "Cancel sign-in" }).click();
  await expect(settings.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();
  await expect(fetch(cancelled)).rejects.toThrow();
  const callback = await startSignIn();
  await page.keyboard.press("Escape");
  await status.click();
  await details.getByRole("button", { name: "Cloud settings" }).click();
  await expect(settings.getByRole("button", { name: "Cancel sign-in" })).toBeVisible();
  expect((await fetch(callback)).status).toBe(200);
  await expect(status).toHaveText("Signed in");
  await page.keyboard.press("Escape");
  await status.click();
  await expect(details.getByText("Cloud sync · Coming soon", { exact: true })).toBeVisible();
  await expect(details.getByText("Devices", { exact: true })).toHaveCount(0);
  await details.getByRole("button", { name: "Cloud settings" }).click();
  await expect(settings.getByText("Coming soon", { exact: true })).toBeVisible();
  await expect(settings.getByText("Your devices", { exact: true })).toHaveCount(0);
  await expect(settings.getByRole("button", { name: "Sync with Cloud" })).toHaveCount(0);
  await settings.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(status).toHaveText("Sign in");
  await fixture.peer.setEarlyAccess(true);
  expect((await fetch(await startSignIn())).status).toBe(200);
  await expect(settings.getByText("Early access enabled", { exact: true })).toBeVisible();
  await settings.getByRole("button", { name: "Sync with Cloud", exact: true }).click();
  await expect(status).toHaveText("Synced");

  const second = await fixture.start("second");
  await signInCloudAcceptanceDevice(second, fixture.peer.origin);
  await expect
    .poll(async () => (await second.client.projects.query()).items.map((item) => item.id))
    .toContain(project.id);
  await second.client.projects.chooseFolder(project.id, { path: second.folder, clone: false });
  await expect.poll(async () => (await second.client.account.projectSyncStatus(project.id)).state).toBe("synced");
  // Reopening reads the current device presence; idle frames never poll device lists.
  await page.keyboard.press("Escape");
  await status.click();
  await details.getByRole("button", { name: "Cloud settings" }).click();
  await expect(settings.getByRole("button", { name: "Rename", exact: true })).toHaveCount(2);
  await settings.getByRole("button", { name: "Rename", exact: true }).first().click();
  await settings.getByRole("textbox", { name: "Device name" }).fill("Cloud UI renamed device");
  await settings.getByRole("button", { name: "Save", exact: true }).click();
  await expect(settings.getByText("Cloud UI renamed device", { exact: true })).toBeVisible();
  expect((await first.client.account.devices()).some((device) => device.name === "Cloud UI renamed device")).toBe(true);
  await settings.getByRole("button", { name: "Make local", exact: true }).click();
  const confirmation = settings.getByRole("dialog");
  await expect(confirmation.getByText("Make this project local?", { exact: true })).toBeVisible();
  await confirmation.getByRole("button", { name: "Make local", exact: true }).click();
  await expect(status).toHaveText("Local");
  await expect(settings.getByRole("button", { name: "Sync with Cloud", exact: true })).toBeVisible();
  await expect.poll(async () => (await second.client.account.projectSyncStatus(project.id)).state).toBe("local");
  expect((await first.client.projects.get(project.id))?.id).toBe(project.id);
  expect((await second.client.projects.get(project.id))?.id).toBe(project.id);
  await settings.getByRole("button", { name: "Sync with Cloud", exact: true }).click();
  await expect(status).toHaveText("Synced");
  await fixture.peer.stop();
  await expect(status).toHaveText("Offline");
  await fixture.peer.restart();
  await first.client.account.retryProjectSync(project.id);
  await expect(status).toHaveText("Synced");
});
