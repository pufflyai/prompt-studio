import { expect, test } from "@playwright/test";
import type { CloudProjectCatalog, CloudProjectDeletion, ProjectCopyDevice } from "@pstdio/sdk/client";
import { folderProjectInput } from "../helpers/folder-project";
import { uiOrigin } from "../ui-server";

const routePath = (path: string) => (url: URL) => url.pathname === path;

const expectScopedDevice = (url: URL, device: ProjectCopyDevice) => {
  expect(url.searchParams.get("deviceAccountId")).toBe(device.accountId);
  expect(url.searchParams.get("deviceManagerOrigin")).toBe(device.managerOrigin);
  expect(url.searchParams.get("deviceId")).toBe(device.deviceId);
};

for (const loseDownloadResponse of [false, true]) {
  test(
    loseDownloadResponse
      ? "a completed Download opens after its accepted response is lost"
      : "a removed local copy stays Cloud only until the user explicitly downloads it",
    async ({ page, request }) => {
      const name = loseDownloadResponse ? "Project copy response recovery" : "Project copy lifecycle";
      const initial = folderProjectInput({ name });
      const project = await request.post(`${uiOrigin}/v1/projects`, { data: initial });
      expect(project.ok()).toBe(true);
      const { id } = await project.json();
      const { environmentId } = await (await request.get(`${uiOrigin}/v1/environment`)).json();
      const account = { accountId: "project-copy-test", managerOrigin: "https://accounts.example.test" };
      const device = { ...account, deviceId: environmentId };
      const endpoint = `/v1/account/projects/${id}`;
      let presence: "downloaded" | "cloud-only" = "downloaded";
      let downloadCalls = 0;
      let cloudDeleteCalls = 0;
      let admissionPending = false;
      const finishDownload = async () => {
        const restored = await request.put(`${uiOrigin}/v1/projects/${id}/environment-binding`, {
          data: { environmentId, ...initial },
        });
        expect(restored.ok()).toBe(true);
        presence = "downloaded";
      };
      const catalog = (): CloudProjectCatalog => ({
        account,
        projects: [
          {
            id,
            name,
            presence,
            online: true,
            actions: {
              download: presence === "cloud-only",
              removeLocal: presence === "downloaded",
              deleteCloud: true,
            },
          },
        ],
        deletions: [],
      });

      await page.route("**/v1/account", (route) =>
        route.fulfill({
          json: {
            login: { ...device, relayOrigin: "https://relay.example.test" },
            cloudProjects: [id],
            cloudProjectsLoaded: true,
            features: { relay: true },
          },
        }),
      );
      await page.route(routePath("/v1/account/projects"), async (route) => {
        expectScopedDevice(new URL(route.request().url()), device);
        await route.fulfill({ json: catalog() });
        if (admissionPending) {
          admissionPending = false;
          await finishDownload();
        }
      });
      await page.route(`**${endpoint}/sync*`, (route) =>
        route.fulfill({ json: { state: "synced", offlineReady: true } }),
      );
      await page.route(routePath(`${endpoint}/local-removal`), (route) => {
        expectScopedDevice(new URL(route.request().url()), device);
        return route.fulfill({
          json: {
            account,
            projectId: id,
            name,
            uploadState: "unknown",
            requiresDiscard: true,
            removesManagedFolder: false,
            providerWorkspaceCount: 0,
          },
        });
      });
      const removing = Promise.withResolvers<void>();
      const finishRemoval = Promise.withResolvers<void>();
      await page.route(`**${endpoint}/remove-local`, async (route) => {
        expect(route.request().postDataJSON()).toEqual({
          discardUnsynced: true,
          expectedAccount: account,
          expectedDevice: device,
        });
        removing.resolve();
        await finishRemoval.promise;
        presence = "cloud-only";
        const removed = await request.delete(`${uiOrigin}/v1/projects/${id}`);
        expect(removed.status()).toBe(204);
        await route.fulfill({ json: { projectId: id, presence } });
      });
      await page.route(`**${endpoint}/delete-cloud`, async (route) => {
        cloudDeleteCalls += 1;
        await route.abort();
      });
      await page.route(`**${endpoint}/download*`, async (route) => {
        const url = new URL(route.request().url());
        expect(url.searchParams.get("accountId")).toBe(account.accountId);
        expect(url.searchParams.get("managerOrigin")).toBe(account.managerOrigin);
        expectScopedDevice(url, device);
        downloadCalls += 1;
        if (loseDownloadResponse) {
          admissionPending = true;
          await route.abort();
          return;
        }
        await finishDownload();
        await route.fulfill({ json: { projectId: id, presence } });
      });
      await page.addInitScript(() => localStorage.setItem("onboarding-complete", "true"));
      await page.goto(`/projects/${id}/`);
      await page.getByRole("option", { name: "Settings", exact: true }).click();
      await page.getByText("Danger zone", { exact: true }).click();
      const danger = page.getByTestId("project-danger-zone-card");
      const removeLocal = danger.getByRole("button", { name: "Delete local version", exact: true });
      await expect(removeLocal).toBeVisible();
      await removeLocal.click();
      const local = page.getByRole("dialog", { name: /Delete local version of/ });
      const submit = local.getByRole("button", { name: "Delete local version", exact: true });
      const discard = local.getByRole("checkbox", { name: "Discard unsynced changes" });
      await expect(discard).toBeVisible();
      await expect(submit).toBeDisabled();
      await discard.press("Space");
      await expect(discard).toBeChecked();
      await submit.click();
      try {
        await removing.promise;
        await expect(submit).toBeDisabled();
      } finally {
        finishRemoval.resolve();
      }

      await expect(page.getByText("Cloud only", { exact: true })).toBeVisible();
      await page.reload();
      const cloud = page.getByRole("dialog", { name, exact: true });
      await expect(cloud).toBeVisible();
      expect(downloadCalls).toBe(0);
      await cloud.getByRole("button", { name: "Back", exact: true }).click();
      const picker = page.getByRole("dialog", { name: "Projects", exact: true });
      const row = picker.getByRole("option", { name, exact: true });
      await expect(row).toBeVisible();
      await row.press("Enter");
      const cloudDelete = cloud.getByRole("button", { name: "Delete cloud project", exact: true });
      await cloudDelete.focus();
      await expect(cloudDelete).toBeFocused();
      await page.keyboard.press("Enter");
      const permanent = page.getByRole("dialog", { name: /Delete cloud project/ });
      await permanent.getByRole("button", { name: "Close", exact: true }).filter({ hasText: "Close" }).click();
      await expect(page.getByText(`Delete cloud project “${name}”?`, { exact: true })).toBeHidden();
      await expect(cloudDelete).toBeFocused();
      expect(downloadCalls).toBe(0);
      expect(cloudDeleteCalls).toBe(0);

      const download = cloud.getByRole("button", { name: "Download", exact: true });
      await download.press("Enter");
      await expect(cloud).toBeHidden();
      expect(downloadCalls).toBe(1);
      expect(cloudDeleteCalls).toBe(0);
      await expect(page).toHaveURL(new RegExp(`/projects/${id}`));
    },
  );
}

test("Cloud deletion recovers from a lost request and resumes the same operation after reload", async ({
  page,
  request,
}) => {
  const id = crypto.randomUUID();
  const name = "Interrupted cloud deletion";
  const { environmentId } = await (await request.get(`${uiOrigin}/v1/environment`)).json();
  const account = { accountId: "cloud-deletion-test", managerOrigin: "https://accounts.example.test" };
  const device = { ...account, deviceId: environmentId };
  const endpoint = `/v1/account/projects/${id}`;
  let online = true;
  let posts = 0;
  const releaseFirst = Promise.withResolvers<void>();
  let receipt: CloudProjectDeletion | undefined;

  await page.route("**/v1/account", (route) =>
    route.fulfill({
      json: {
        login: { ...device, relayOrigin: "https://relay.example.test" },
        cloudProjects: receipt ? [] : [id],
        cloudProjectsLoaded: true,
        features: { relay: true },
      },
    }),
  );
  await page.route(routePath("/v1/account/projects"), (route) => {
    expectScopedDevice(new URL(route.request().url()), device);
    const result: CloudProjectCatalog = {
      account,
      projects: receipt
        ? []
        : [
            {
              id,
              name,
              presence: "cloud-only",
              online,
              actions: { download: online, removeLocal: false, deleteCloud: online },
            },
          ],
      deletions: receipt && receipt.state !== "completed" ? [{ ...receipt, name }] : [],
    };
    return route.fulfill({ json: result });
  });
  await page.route(`**${endpoint}/deletion?*`, (route) => {
    expectScopedDevice(new URL(route.request().url()), device);
    if (!online) return route.fulfill({ status: 503, json: { error: "Connect to Cloud to check deletion" } });
    return receipt
      ? route.fulfill({ json: receipt })
      : route.fulfill({ status: 404, json: { error: "No deletion for this cloud project" } });
  });
  await page.route(`**${endpoint}/delete-cloud`, async (route) => {
    expect(route.request().postDataJSON()).toEqual({ confirm: true, expectedAccount: account, expectedDevice: device });
    posts += 1;
    if (posts === 1) {
      await releaseFirst.promise;
      online = false;
      return route.abort();
    }
    if (!receipt) {
      receipt = {
        operationId: crypto.randomUUID(),
        projectId: id,
        state: "needs-attention",
        startedAt: new Date().toISOString(),
        completedAt: null,
      };
      return route.abort();
    }
    receipt = { ...receipt, state: "completed", completedAt: new Date().toISOString() };
    return route.fulfill({ json: receipt });
  });
  await page.addInitScript(() => localStorage.setItem("onboarding-complete", "true"));
  await page.goto(`/projects/${id}/`);
  const choice = page.getByRole("dialog", { name, exact: true });
  await expect(choice).toBeVisible();
  await choice.getByRole("button", { name: "Delete cloud project", exact: true }).click();
  const confirmation = page.getByRole("dialog", { name: /Delete cloud project/ });
  await confirmation.getByRole("button", { name: "Delete cloud project", exact: true }).click();
  try {
    await expect(choice.getByText("Deleting cloud project", { exact: true })).toBeVisible();
    await expect(choice.getByRole("button", { name: "Retry", exact: true })).toHaveCount(0);
    await choice.getByRole("button", { name: "Back", exact: true }).click();
    await page
      .getByRole("dialog", { name: "Projects", exact: true })
      .getByRole("option", { name, exact: true })
      .click();
    await expect(choice.getByText("Deleting cloud project", { exact: true })).toBeVisible();
    await expect(choice.getByRole("button", { name: "Download", exact: true })).toHaveCount(0);
  } finally {
    releaseFirst.resolve();
  }
  await expect(choice.getByText("Checking whether Cloud deletion started")).toBeVisible();
  const offline = choice.getByText("Connect to Cloud to download or delete this project.");
  await expect(offline).toBeVisible();
  online = true;
  await choice.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(offline).toBeHidden();
  await choice.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(choice.getByText("Cloud deletion needs attention")).toBeVisible();
  expect(posts).toBe(2);

  await page.reload();
  await expect(choice.getByText("Cloud deletion needs attention")).toBeVisible();
  await choice.getByRole("button", { name: "Retry", exact: true }).click();
  const picker = page.getByRole("dialog", { name: "Projects", exact: true });
  await expect(picker).toBeVisible();
  await expect(picker.getByRole("option", { name, exact: true })).toHaveCount(0);
  expect(posts).toBe(3);
});
