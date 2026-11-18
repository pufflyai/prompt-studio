import { expect, test } from "@playwright/test";
import type { CloudProjectCatalog } from "@pstdio/sdk/client";
import { folderProjectInput } from "../helpers/folder-project";
import { uiOrigin } from "../ui-server";

test("a removed local copy stays Cloud only until the user explicitly downloads it", async ({ page, request }) => {
  const name = "Project copy lifecycle";
  const initial = folderProjectInput({ name });
  const project = await request.post(`${uiOrigin}/v1/projects`, { data: initial });
  expect(project.ok()).toBe(true);
  const { id } = await project.json();
  const { environmentId } = await (await request.get(`${uiOrigin}/v1/environment`)).json();
  const account = { accountId: "project-copy-test", managerOrigin: "https://accounts.example.test" };
  const endpoint = `/v1/account/projects/${id}`;
  let presence: "downloaded" | "cloud-only" = "downloaded";
  let downloadCalls = 0;
  let cloudDeleteCalls = 0;
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
        login: { ...account, deviceId: environmentId, relayOrigin: "https://relay.example.test" },
        cloudProjects: [id],
        cloudProjectsLoaded: true,
        features: { relay: true },
      },
    }),
  );
  await page.route("**/v1/account/projects", (route) => route.fulfill({ json: catalog() }));
  await page.route(`**${endpoint}/sync*`, (route) => route.fulfill({ json: { state: "synced", offlineReady: true } }));
  await page.route(`**${endpoint}/local-removal`, (route) =>
    route.fulfill({
      json: {
        account,
        projectId: id,
        name,
        uploadState: "unknown",
        requiresDiscard: true,
        removesManagedFolder: false,
        providerWorkspaceCount: 0,
      },
    }),
  );
  await page.route(`**${endpoint}/remove-local`, async (route) => {
    expect(route.request().postDataJSON()).toEqual({ discardUnsynced: true, expectedAccount: account });
    presence = "cloud-only";
    const removed = await request.delete(`${uiOrigin}/v1/projects/${id}`);
    expect(removed.status()).toBe(204);
    await route.fulfill({ json: { projectId: id, presence } });
  });
  await page.route(`**${endpoint}/delete-cloud`, async (route) => {
    cloudDeleteCalls += 1;
    await route.abort();
  });
  await page.route(`**${endpoint}/download`, async (route) => {
    downloadCalls += 1;
    const restored = await request.put(`${uiOrigin}/v1/projects/${id}/environment-binding`, {
      data: { environmentId, ...initial },
    });
    expect(restored.ok()).toBe(true);
    presence = "downloaded";
    await route.fulfill({ json: { projectId: id, presence } });
  });
  await page.addInitScript(() => localStorage.setItem("onboarding-complete", "true"));
  await page.goto(`/projects/${id}/`);
  await page.getByRole("option", { name: "Settings", exact: true }).click();
  await page.getByText("Danger zone", { exact: true }).click();
  const danger = page.getByTestId("project-danger-zone-card");
  await danger.getByRole("button", { name: "Delete local version", exact: true }).click();
  const local = page.getByRole("dialog", { name: /Delete local version of/ });
  const submit = local.getByRole("button", { name: "Delete local version", exact: true });
  const discard = local.getByRole("checkbox", { name: "Discard unsynced changes" });
  await expect(discard).toBeVisible();
  await expect(submit).toBeDisabled();
  await discard.press("Space");
  await expect(discard).toBeChecked();
  await submit.click();

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
  await expect(cloudDelete).toBeFocused();
  expect(downloadCalls).toBe(0);
  expect(cloudDeleteCalls).toBe(0);

  const download = cloud.getByRole("button", { name: "Download", exact: true });
  await download.focus();
  await page.keyboard.press("Enter");
  await expect(cloud).toBeHidden();
  expect(downloadCalls).toBe(1);
  expect(cloudDeleteCalls).toBe(0);
  await expect(page).toHaveURL(new RegExp(`/projects/${id}`));
});
