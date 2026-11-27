import type { ChildProcess } from "node:child_process";
import { mkdtempSync, readFileSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { folderProjectInput } from "../helpers/folder-project";
import { stopPendingTestProcesses } from "../scripts/pending-test-processes";
import { test as base, expect } from "../scripts/playwright-test";
import { waitForProcessReady } from "../scripts/process-readiness";
import { fixtureServerReady } from "../scripts/server-readiness";
import { restorePackagedBrowserViewport } from "./packaged-browser-viewport";
import { PACKAGED_DASHBOARD_BROWSER } from "./packaged-chromium";
import { createCloudAcceptanceFixture, signInCloudAcceptanceDevice } from "./packaged-cloud-acceptance.fixture";
import { buildBinary } from "./packaged-helpers";
import { signInBrowser, stopProcess } from "./packaged-serve-helpers";
import { packagedAccountCode } from "./packaged-sync-identity.fixture";

interface Resources {
  root: string;
  children: Set<ChildProcess>;
  fixture?: Awaited<ReturnType<typeof createCloudAcceptanceFixture>>;
}
const test = base.extend<{ resources: Resources }>({
  // biome-ignore lint/correctness/noEmptyPattern: Playwright reads fixture dependency patterns.
  resources: async ({}, use, testInfo) => {
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
    if (testInfo.status !== testInfo.expectedStatus && resources.fixture) {
      await testInfo.attach("cloud-runtime-diagnostics", {
        body: JSON.stringify(await resources.fixture.diagnostics(), null, 2),
        contentType: "application/json",
      });
    }
    await stopPendingTestProcesses().catch((cause) => failures.push(cause));
    const stopped = await Promise.allSettled([
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
test.use({ ignoreHTTPSErrors: true, launchOptions: PACKAGED_DASHBOARD_BROWSER });
test.beforeAll(() => buildBinary());

// Controlled-peer qualification of the production extension. Real Google and deployed services remain PS-789.
test("Cloud settings respect early access and manage devices and project sync through the real bridge", async ({
  resources,
  context,
  page,
}) => {
  // Critical: early access gates project sync; making local must preserve both devices' copies.
  const fixture = await createCloudAcceptanceFixture(resources.root, resources.children, { cloudUi: true });
  resources.fixture = fixture;
  await fixture.peer.setEarlyAccess(false);
  const first = await fixture.start("first");
  const project = await first.client.projects.create(folderProjectInput({ name: "Cloud UI acceptance" }, first.folder));
  await context.addInitScript(() => localStorage.setItem("onboarding-complete", "true"));
  await signInBrowser(page, first.host.descriptor, `/projects/${project.id}/`);
  const status = page.frameLocator('iframe[title="Prompt Studio Cloud"]').getByTestId("cloud-status-item");
  const details = page.frameLocator('iframe[title="Cloud details"]');
  const settings = page.frameLocator('iframe[title="Cloud"]');
  const settingsFrame = page.locator('iframe[title="Cloud"]');
  const openSettings = async () => {
    const button = details.getByRole("button", { name: "Cloud settings" });
    // Closing settings can reveal the still-open status popover. Its trigger toggles it closed.
    if (!(await button.isVisible()))
      await page.locator("footer").getByRole("button", { name: "Prompt Studio Cloud", exact: true }).click();
    await expect(button).toBeVisible();
    await button.click();
    await expect(settingsFrame).toBeVisible();
  };
  const closeSettings = async () => {
    await page.keyboard.press("Escape");
    await expect(settingsFrame).toBeHidden();
  };
  await expect(status).toHaveText("Sign in");
  await context.setOffline(true);
  await expect(status).toHaveText("Connection lost");
  await context.setOffline(false);
  await expect(status).toHaveText("Sign in");
  await openSettings();
  const signIn = settings.getByRole("button", { name: "Sign in", exact: true });
  const providers = settings.getByRole("dialog", { name: "Sign in", exact: true });
  const chooseProvider = async (provider: "Google" | "Microsoft") => {
    await signIn.click();
    await expect(providers).toBeVisible();
    await providers.getByRole("button", { name: `Sign in with ${provider}`, exact: true }).click();
    await expect(providers).toBeHidden();
  };
  await expect(signIn).toBeVisible();
  const startSignIn = async (provider: "Google" | "Microsoft" = "Google") => {
    const viewport = page.viewportSize()!;
    const opened = context.waitForEvent("page");
    const destination = context.waitForEvent(
      "request",
      (request) => new URL(request.url()).pathname === "/v1/native-login",
    );
    await chooseProvider(provider);
    const popup = await opened;
    const login = new URL((await destination).url());
    expect(login.origin).toBe(fixture.peer.origin);
    if (provider === "Microsoft") expect(login.searchParams.get("provider")).toBe("microsoft");
    await expect.poll(() => new URL(popup.url()).pathname).toBe("/v1/native-login");
    await popup.close();
    await restorePackagedBrowserViewport(page, viewport);
    const callback = new URL(login.searchParams.get("callback")!);
    callback.searchParams.set("state", login.searchParams.get("state")!);
    callback.searchParams.set("code", "controlled-fixture-login");
    return callback;
  };
  // Actual UI initiation and cancellation share the native request even after the view is reopened.
  const cancelled = await startSignIn("Microsoft");
  await expect(settings.getByRole("button", { name: "Cancel sign-in" })).toBeVisible();
  await settings.getByRole("button", { name: "Cancel sign-in" }).click();
  await expect(signIn).toBeVisible();
  await expect(fetch(cancelled)).rejects.toThrow();
  const cancelledNotice = settings.getByRole("alert").filter({ hasText: "Sign-in did not complete." });
  await expect(cancelledNotice).toBeVisible();
  const cancelledAttempt = (await first.client.account.status()).loginAttempt;
  await fixture.peer.setMicrosoftSignIn(false);
  await chooseProvider("Microsoft");
  const unavailableNotice = settings.getByRole("alert").filter({ hasText: "has not enabled Microsoft sign-in" });
  await expect(unavailableNotice).toBeVisible();
  await expect(cancelledNotice).toBeHidden();
  expect((await first.client.account.status()).loginAttempt).toEqual(cancelledAttempt);
  await unavailableNotice.getByRole("button", { name: "Dismiss", exact: true }).click();
  await expect(settings.getByRole("alert")).toHaveCount(0);
  await fixture.peer.setMicrosoftSignIn(true);
  const callback = await startSignIn("Microsoft");
  const microsoftAccount = "microsoft-owner";
  callback.searchParams.set("code", packagedAccountCode(microsoftAccount));
  await closeSettings();
  await openSettings();
  await expect(settings.getByRole("button", { name: "Cancel sign-in" })).toBeVisible();
  expect((await fetch(callback)).status).toBe(200);
  await expect(status).toHaveText("Signed in");
  expect((await first.client.account.status()).login?.accountId).toBe(microsoftAccount);
  await context.setOffline(true);
  await expect(status).toHaveText("Connection lost");
  await context.setOffline(false);
  await expect(status).toHaveText("Signed in");
  await closeSettings();
  const detailsButton = details.getByRole("button", { name: "Cloud settings" });
  if (!(await detailsButton.isVisible()))
    await page.locator("footer").getByRole("button", { name: "Prompt Studio Cloud", exact: true }).click();
  await expect(details.getByText("Devices", { exact: true })).toHaveCount(0);
  await details.getByRole("button", { name: "Cloud settings" }).click();
  await expect(settings.getByText("Coming soon", { exact: true })).toBeVisible();
  await expect(settings.getByText("Your devices", { exact: true })).toBeVisible();
  await expect(settings.getByRole("button", { name: "Rename", exact: true })).toHaveCount(1);
  await expect(settings.getByRole("button", { name: "Sync with Cloud" })).toHaveCount(0);
  await settings.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(status).toHaveText("Sign in");
  // Critical: retiring the account popover must keep the independently owned settings surface open.
  await expect(settingsFrame).toBeVisible();
  await expect(signIn).toBeVisible();
  await fixture.peer.setEarlyAccess(true);
  expect((await fetch(await startSignIn())).status).toBe(200);
  await expect(status).toHaveText("Local");
  await expect(settingsFrame).toBeVisible();
  await expect(settings.getByText("Early access enabled", { exact: true })).toBeVisible();
  await settings.getByRole("button", { name: "Sync with Cloud", exact: true }).click();
  await test.step("Finish initial project sync before checking the status badge", async () => {
    await expect
      .poll(async () => (await first.client.account.projectSyncStatus(project.id)).state, {
        intervals: [500],
        timeout: 15_000,
      })
      .toBe("synced");
  });
  await expect(status).toHaveText("Synced");

  const second = await test.step("Start the cold second app and register its default tools", async () => {
    const device = await fixture.start("second");
    await waitForProcessReady(device.host.child, "Second app readiness", async () =>
      fixtureServerReady.test(readFileSync(device.logPath, "utf8")) ? true : undefined,
    );
    return device;
  });
  await signInCloudAcceptanceDevice(second, fixture.peer.origin);
  await expect
    .poll(async () => (await second.client.projects.query()).items.map((item) => item.id))
    .toContain(project.id);
  await second.client.projects.chooseFolder(project.id, { path: second.folder, clone: false });
  await test.step("Finish local project setup before checking sync", async () => {
    await waitForProcessReady(second.host.child, "Second project readiness", async () => {
      const completed = readFileSync(second.logPath, "utf8")
        .split("\n")
        .some((line) => {
          if (!line.startsWith("{")) return false;
          const phase = JSON.parse(line);
          return (
            phase.event === "runtime.setup.phase" &&
            phase.phase === "project.extension_enable" &&
            phase.project_id === project.id &&
            phase.state === "completed"
          );
        });
      return completed ? true : undefined;
    });
  });
  // App installation and project setup have separate steps; retain the five-second sync assertion.
  await test.step("Synchronize the ready second app", async () => {
    await expect
      .poll(async () => (await second.client.account.projectSyncStatus(project.id)).state, { intervals: [100] })
      .toBe("synced");
  });
  // Reopening reads the current device presence; idle frames never poll device lists.
  await closeSettings();
  await openSettings();
  await expect(settings.getByRole("button", { name: "Rename", exact: true })).toHaveCount(2);
  await settings.getByRole("button", { name: "Rename", exact: true }).first().click();
  await settings.getByRole("textbox", { name: "Device name" }).fill("Cloud UI renamed device");
  await settings.getByRole("button", { name: "Save", exact: true }).click();
  await expect(settings.getByText("Cloud UI renamed device", { exact: true })).toBeVisible();
  expect((await first.client.account.devices()).some((device) => device.name === "Cloud UI renamed device")).toBe(true);
  await settings.getByRole("button", { name: "Make local", exact: true }).click();
  const confirmation = settings.getByRole("dialog");
  await expect(confirmation).toBeVisible();
  await expect(confirmation).toContainText(project.name);
  await confirmation.getByRole("button", { name: "Make local", exact: true }).click();
  await expect(status).toHaveText("Local");
  // Retire private project data while preserving the independently owned global settings destination.
  await expect(settingsFrame).toBeVisible();
  await expect(settings.getByRole("button", { name: "Sync with Cloud", exact: true })).toBeVisible();
  // Account membership is discovered on refresh; issued access remains valid until renewal.
  // Exercise the public explicit refresh here; native-account tests cover the idle scheduled refresh.
  await second.client.account.retryProjectSync(project.id);
  await expect.poll(async () => (await second.client.account.projectSyncStatus(project.id)).state).toBe("local");
  expect((await first.client.projects.get(project.id))?.id).toBe(project.id);
  expect((await second.client.projects.get(project.id))?.id).toBe(project.id);
  await settings.getByRole("button", { name: "Sync with Cloud", exact: true }).click();
  await expect(status).toHaveText("Synced");
  await fixture.peer.stop();
  await expect(status).toHaveText("Connection lost");
  await fixture.peer.restart();
  await first.client.account.retryProjectSync(project.id);
  await expect(status).toHaveText("Synced");
});
