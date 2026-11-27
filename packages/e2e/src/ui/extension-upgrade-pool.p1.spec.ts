import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { expect, type Locator, type Page, type Route, test } from "@playwright/test";
import type { ProjectExtensionInstance } from "@pstdio/sdk/api";
import { extensionUpgradeNeedsReviewCode } from "pstdio-api-contracts/extension-host";
import { folderProjectInput } from "../helpers/folder-project";
import { uiOrigin } from "../ui-server";

const confirmedConflict = {
  code: extensionUpgradeNeedsReviewCode,
  error: "The installed files differ from their original release.",
  details: { localEditsConfirmed: true },
};

const completedProposal = (reviewId: string, kind: "local" | "incoming") =>
  JSON.stringify({ reviewId, revision: "refreshed", resolutions: [{ kind, path: "src/extension.ts" }] });

const openConflictReview = async (page: Page, row: Locator) => {
  await row.getByRole("button", { name: "Upgrade conflict", exact: true }).click();
  await page.getByRole("button", { name: "Resolve", exact: true }).click();
};

const askForCorrection = async (page: Page, review: Locator) => {
  await review.getByRole("button", { name: "Apply upgrade" }).click();
  await expect(review).toContainText("Set the manifest version to 2.0.0");
  await expect(review.getByRole("button", { name: "Ask agent" })).toBeEnabled();
  const instructions = "Correct the manifest version and preserve our local export.";
  await review.getByRole("textbox", { name: "Additional instructions (optional)" }).fill(instructions);
  await review.getByRole("button", { name: "Ask agent" }).click();
  await expect(review).toHaveCount(0);
  await expect(page.locator('[contenteditable="true"]').filter({ hasText: instructions })).toBeVisible();
};

// Critical risks: real queue ownership and directly reachable recovery must survive list/detail navigation.
test("keeps individual recovery after completed bulk upgrade progress disappears", async ({ page, request }) => {
  const folder = join(process.env.E2E_HOME!, `upgrade-progress-${Date.now()}`);
  mkdirSync(folder, { recursive: true });
  const created = await request.post(`${uiOrigin}/v1/projects`, {
    data: folderProjectInput({ name: "Upgrade progress" }, folder),
  });
  expect(created.ok()).toBe(true);
  const project = (await created.json()) as { id: string };
  const inventory = await (await request.get(`${uiOrigin}/v1/projects/${project.id}/extensions`)).json();
  const targets: ProjectExtensionInstance[] = inventory.extensions
    .slice(0, 3)
    .map((extension: ProjectExtensionInstance, index: number) => ({
      ...extension,
      canUpgrade: index !== 2,
      hasPublishedAlternative: index === 2,
      ...(index === 2 && { scope: "repo", enabled: true }),
    }));
  expect(targets).toHaveLength(3);
  const waiting: { route: Route; extension: ProjectExtensionInstance }[] = [];
  const heldReads: Route[] = [];
  const releaseComparison = Promise.withResolvers<void>();
  let holdReads = false;
  await page.route(`**/v1/projects/${project.id}/extensions`, async (route) => {
    if (holdReads) {
      heldReads.push(route);
      return;
    }
    await route.fulfill({ json: { ...inventory, upgradeConcurrency: 2, extensions: targets } });
  });
  await page.route(`**/v1/projects/${project.id}/extensions/*/upgrade`, async (route) => {
    const id = decodeURIComponent(new URL(route.request().url()).pathname.split("/").at(-2)!);
    const extension = targets.find((target) => target.id === id);
    if (!extension) throw new Error(`Unexpected extension upgrade request for ${id}`);
    waiting.push({ route, extension });
  });
  await page.addInitScript((projectId) => {
    localStorage.setItem("onboarding-complete", "true");
    localStorage.setItem("dashboard-wb2:selected-project:global", projectId);
  }, project.id);
  await page.goto(`/projects/${project.id}`);
  await page.getByRole("option", { name: "Extensions", exact: true }).click();
  const row = (id: string) =>
    page
      .getByTestId("extension-entry")
      .filter({ hasText: targets.find((extension) => extension.id === id)!.displayName, visible: true });
  await page.getByTestId("extensions-upgrade-all").click();
  await expect.poll(() => waiting.length).toBe(2);
  await expect(row(targets[2]!.id).getByTestId("extension-row-upgrade")).toHaveText("Waiting");
  await expect(row(targets[2]!.id).getByTestId("extension-row-upgrade")).not.toHaveAttribute("aria-busy", "true");
  for (const target of targets.slice(0, 2)) {
    const button = row(target.id).getByTestId("extension-row-upgrade");
    await expect(button).toContainText("Upgrading");
    await expect(button).toHaveAttribute("aria-busy", "true");
    await expect(row(target.id).getByRole("progressbar")).toHaveCount(0);
  }
  await expect(page.getByTestId("extensions-upgrade-all").getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "0",
  );
  await row(targets[0]!.id).click();
  await expect(page.getByTestId("extension-detail")).toBeVisible();
  await expect(page.getByTestId("extension-upgrade")).toBeDisabled();
  await expect(page.getByTestId("extension-upgrade").getByRole("progressbar")).toHaveCount(0);
  await page.goBack();
  await expect(page.getByTestId("extensions-panel")).toBeVisible();
  expect(waiting).toHaveLength(2);
  const succeed = async (entry: (typeof waiting)[number]) =>
    entry.route.fulfill({
      json: { changed: true, extension: { ...entry.extension, version: "9.9.9", canUpgrade: false } },
    });
  holdReads = true;
  try {
    await succeed(waiting[0]!);
    await expect.poll(() => waiting.length).toBe(3);
    const succeededRow = row(waiting[0]!.extension.id);
    const succeededButton = succeededRow.getByTestId("extension-row-upgrade");
    await expect(succeededRow).toContainText("v9.9.9");
    await expect(succeededButton).toHaveCount(0);
    await expect(page.getByTestId("extensions-panel")).toBeVisible();
    expect(waiting).toHaveLength(3);
    await waiting[1]!.route.fulfill({ status: 400, json: { error: "Registry unavailable" } });
    const failedButton = row(waiting[1]!.extension.id).getByTestId("extension-row-upgrade");
    await expect(failedButton.getByRole("alert")).toContainText("Registry unavailable");
    await expect(failedButton).toContainText("Retry");
    await expect(failedButton).not.toContainText(/\d+s/);
    const local = waiting[2]!.extension;
    await waiting[2]!.route.fulfill({
      status: 409,
      json: confirmedConflict,
    });
    const batchButton = page.getByTestId("extensions-upgrade-all");
    await expect(batchButton).toHaveCount(0);
    await expect(row(local.id).getByRole("button", { name: "Upgrade conflict", exact: true })).toBeVisible();
    // Hiding the completed batch preserves individual failures and their recovery actions.
    await failedButton.click();
    await expect.poll(() => waiting.length).toBe(4);
    await expect(failedButton).toHaveAttribute("aria-busy", "true");
    await succeed(waiting[3]!);
    await expect(failedButton).toHaveCount(0);
    await row(waiting[3]!.extension.id).click();
    const detail = page.getByTestId("extension-detail").filter({ visible: true });
    await expect(detail).toBeVisible();
    await expect(detail.getByTestId("extension-upgrade")).toHaveCount(0);
    expect(waiting).toHaveLength(4);

    const reviewId = "1da7f099-0539-49c5-bc98-d5ad8c09ad01";
    let refreshed = false;
    await page.route(`**/v1/projects/${project.id}/extensions/*/upgrade-review`, async (route) => {
      const { action, revision } = route.request().postDataJSON();
      if (action === "apply")
        return route.fulfill({
          status: 400,
          json: { error: "Set the manifest version to 2.0.0 before applying the upgrade." },
        });
      if (action === "begin") await releaseComparison.promise;
      if (action === "file") {
        expect(revision).toBe("refreshed");
        return route.fulfill({
          json: { action, file: { base: "old", local: "latest local", incoming: "upstream", proposed: null } },
        });
      }
      if (action === "refresh") {
        expect(revision).toBe("initial");
        refreshed = true;
      }
      return route.fulfill({
        json: {
          action,
          review: {
            id: reviewId,
            localPath: local.sourcePath,
            incomingVersion: "2.0.0",
            revision: refreshed ? "refreshed" : "initial",
            createdAt: "2026-01-01T00:00:00Z",
            separateLocalProvider: true,
            hasOriginal: true,
            resolutions: [],
            changes: [{ path: "src/extension.ts", status: "conflict", localKind: "file", incomingKind: "file" }],
            changedPaths: refreshed ? undefined : ["src/extension.ts"],
          },
        },
      });
    });
    await page.goBack();
    await openConflictReview(page, row(local.id));
    const review = page.getByRole("dialog", { name: `Review ${local.displayName} upgrade` });
    await expect(review).toBeVisible();
    await expect(review.getByRole("textbox", { name: "Additional instructions (optional)" })).toHaveCount(0);
    await expect(review.getByRole("button", { name: "Ask agent" })).toHaveCount(0);
    await expect(review.getByRole("button", { name: "Keep my version" })).toBeEnabled();
    await expect(review.getByRole("button", { name: "Use their version" })).toBeDisabled();
    releaseComparison.resolve();
    await expect(review).toContainText("The extension source changed during this review");
    await review.getByRole("button", { name: "Close review" }).click();
    await page.getByRole("button", { name: "System activity", exact: true }).click();
    await page
      .getByRole("alert")
      .filter({ hasText: confirmedConflict.error })
      .getByRole("button", { name: "Resolve", exact: true })
      .click();
    await expect(review).toBeVisible();
    await expect(review.getByRole("button", { name: "Keep local", exact: true })).toHaveCount(0);
    await expect(review.getByRole("button", { name: "Apply upgrade" })).toHaveCount(0);
    await page.route(
      (url) => url.pathname === `/v1/projects/${project.id}/sessions` && url.searchParams.get("anchorId") === reviewId,
      (route) => route.fulfill({ json: { items: [{ id: "upgrade-review-session", status: "completed" }] } }),
    );
    let reply = JSON.stringify({ reviewId, revision: "initial", resolutions: [] });
    await page.route("**/v1/sessions/upgrade-review-session/conversation", (route) =>
      route.fulfill({ json: { messages: [{ role: "assistant", parts: [{ type: "text", text: reply }] }] } }),
    );
    await expect(review.getByRole("button", { name: "Apply upgrade" })).toHaveCount(0);
    await expect(review.getByRole("button", { name: "Import agent proposal" })).toHaveCount(0);
    const instructions = "Keep the local export for our integration.";
    await review.getByRole("textbox", { name: "Additional instructions (optional)" }).fill(instructions);
    await review.getByRole("button", { name: "Ask agent" }).click();
    await expect(review).toHaveCount(0);
    await expect(page.locator('[contenteditable="true"]').filter({ hasText: instructions })).toBeVisible();
    expect(refreshed).toBe(true);
    reply = completedProposal(reviewId, "local");
    await openConflictReview(page, row(local.id));
    await expect(review).toContainText("The agent prepared a resolution.");
    await expect(review.getByRole("button", { name: "Apply upgrade" })).toBeEnabled();
    await askForCorrection(page, review);
    reply = completedProposal(reviewId, "incoming");
    await openConflictReview(page, row(local.id));
    await expect(review).toContainText("The agent prepared a resolution.");
    await expect(review.getByRole("button", { name: "Apply upgrade" })).toBeEnabled();
    await review.getByRole("button", { name: "Keep my version" }).click();
    await expect(review).toHaveCount(0);
    await expect(row(local.id)).toContainText(`v${local.version}`);
    await expect(row(local.id).getByRole("button", { name: "Upgrade conflict", exact: true })).toHaveCount(0);
    await page.goBack();
    await expect(page.getByTestId("extensions-panel").filter({ visible: true })).toBeVisible();
    await expect(review).toHaveCount(0);
    expect(waiting).toHaveLength(4);
  } finally {
    releaseComparison.resolve();
    await Promise.all(heldReads.map((route) => route.abort()));
    await page.unrouteAll({ behavior: "ignoreErrors" });
  }
});

// Critical risk: catalog retries and instance toggles must stay usable across navigation.
test("keeps install retries and toggle progress attached to their controls across navigation", async ({
  page,
  request,
}) => {
  const folder = join(process.env.E2E_HOME!, `install-feedback-${Date.now()}`);
  mkdirSync(folder, { recursive: true });
  const created = await request.post(`${uiOrigin}/v1/projects`, {
    data: folderProjectInput({ name: "Install feedback" }, folder),
  });
  expect(created.ok()).toBe(true);
  const project = (await created.json()) as { id: string };
  const inventory = await (await request.get(`${uiOrigin}/v1/projects/${project.id}/extensions`)).json();
  const catalog = {
    installName: "grouped-install-fixture",
    extensionId: "example.grouped-install",
    displayName: "Grouped install fixture",
    description: "Fresh install feedback",
    installed: false,
    origin: { kind: "git", url: "https://example.com/tools.git", ref: "main", path: "grouped" },
  };
  const instance: ProjectExtensionInstance = {
    ...inventory.extensions[0],
    id: "grouped-installed-instance",
    installName: catalog.installName,
    extensionId: catalog.extensionId,
    displayName: catalog.displayName,
    canUpgrade: false,
    updateAvailable: true,
    version: "1.0.0",
  };
  let installed = false;
  const installs: Route[] = [];
  await page.route(`**/v1/projects/${project.id}/extensions`, async (route) => {
    await route.fulfill({
      json: {
        ...inventory,
        extensions: installed ? [...inventory.extensions, instance] : inventory.extensions,
        marketplace: [...inventory.marketplace, { ...catalog, installed }],
      },
    });
  });
  await page.route(`**/v1/projects/${project.id}/extensions/install`, (route) => {
    installs.push(route);
  });
  await page.addInitScript((id) => {
    localStorage.setItem("onboarding-complete", "true");
    localStorage.setItem("dashboard-wb2:selected-project:global", id);
  }, project.id);
  await page.clock.install();
  await page.goto(`/projects/${project.id}`);
  await page.getByRole("option", { name: "Extensions", exact: true }).click();
  const availableRow = page.getByTestId("marketplace-extension-entry").filter({ hasText: catalog.displayName });
  const installButton = availableRow.getByTestId("marketplace-extension-install");
  await installButton.click();
  await expect.poll(() => installs.length).toBe(1);
  await expect(installButton).toHaveAttribute("aria-busy", "true");
  const pendingLabel = await installButton.getAttribute("aria-label");
  expect(pendingLabel).toBeTruthy();
  await page.clock.fastForward(1_500);
  await expect(installButton).toHaveAttribute("aria-label", pendingLabel!);
  await expect(availableRow.getByRole("progressbar")).toHaveCount(0);
  await availableRow.click();
  const availableButton = page.getByTestId("available-extension-install");
  await expect(availableButton).toHaveAttribute("aria-busy", "true");
  await installs[0]!.fulfill({ status: 400, json: { error: "Registry unavailable" } });
  await expect(availableButton.getByRole("alert")).toContainText("Registry unavailable");
  await expect(availableButton).toContainText("Retry");
  await expect(availableButton).not.toContainText(/\d+s/);
  await availableButton.click();
  await expect.poll(() => installs.length).toBe(2);
  await expect(availableButton).toHaveAttribute("aria-busy", "true");
  await installs[1]!.fulfill({
    status: 409,
    json: { error: "Already installed", code: "extension_already_installed" },
  });
  await page.getByRole("button", { name: "Replace", exact: true }).click();
  await expect.poll(() => installs.length).toBe(3);
  expect(installs[2]!.request().postDataJSON().force).toBe(true);
  const detail = page.getByTestId("extension-detail").filter({ visible: true });
  installed = true;
  await installs[2]!.fulfill({ json: { extension: instance } });
  await expect(detail).toBeVisible();
  await expect(detail.getByTestId("extension-upgrade")).toHaveCount(0);
  await page.goBack();
  const installedRow = page.getByTestId("extension-entry").filter({ hasText: catalog.displayName });
  await expect(installedRow).toBeVisible();
  await expect(installedRow).toBeFocused();
  await expect(installedRow.getByTestId("extension-row-upgrade")).toHaveCount(0);
  await installedRow.click();
  await expect(detail.getByTestId("extension-upgrade")).toHaveCount(0);
  await expect(detail).toBeVisible();
  expect(installs).toHaveLength(3);

  const toggles: Route[] = [];
  const deletions: Route[] = [];
  await page.route(`**/v1/projects/${project.id}/extensions/${instance.id}*`, async (route) => {
    if (route.request().method() === "PATCH") toggles.push(route);
    else if (route.request().method() === "DELETE") deletions.push(route);
    else await route.fallback();
  });
  const toggleName = { name: `Toggle ${catalog.displayName}`, exact: true };
  const detailToggle = detail.getByRole("checkbox", toggleName);
  const rowToggle = installedRow.getByRole("checkbox", toggleName);
  await detailToggle.press("Space");
  await expect.poll(() => toggles.length).toBe(1);
  const enabled = !instance.enabled;
  expect(toggles[0]!.request().postDataJSON()).toEqual({ enabled });
  await expect(detail.getByRole("status").filter({ hasText: catalog.displayName })).toHaveCount(1);
  await expect(detailToggle).toHaveAttribute("aria-busy", "true");
  await expect(detailToggle).toHaveJSProperty("checked", enabled);
  await expect(detail.locator('[data-part="thumb"] [data-testid="extension-toggle-spinner"]')).toBeVisible();
  await page.goBack();
  await expect(rowToggle).toBeDisabled();
  await expect(rowToggle).toHaveAttribute("aria-busy", "true");
  await expect(rowToggle).toHaveJSProperty("checked", enabled);
  await expect(installedRow.locator('[data-part="thumb"] [data-testid="extension-toggle-spinner"]')).toBeVisible();
  await expect(installedRow.getByTestId("extension-row-upgrade")).toHaveCount(0);
  await toggles[0]!.fulfill({ status: 400, json: { error: "Could not change extension state" } });
  const toggleError = installedRow.getByRole("alert");
  await expect(toggleError).toContainText("Could not change extension state");
  await expect(rowToggle).toHaveJSProperty("checked", instance.enabled);

  const reload = Promise.withResolvers<Route>();
  await page.route(`**/v1/projects/${project.id}/extensions/${instance.id}/reload`, (route) => reload.resolve(route));
  await installedRow.press("Enter");
  await expect(detail).toBeVisible();
  await detail.getByTestId("extension-reload").click();
  const pendingReload = await reload.promise;
  const rowRetry = toggleError.getByRole("button", { name: "Retry" });
  await page.goBack();
  await expect(rowToggle).toBeDisabled();
  await expect(rowRetry).toBeDisabled();
  instance.updateAvailable = false;
  await pendingReload.fulfill({ json: instance });

  await rowRetry.click();
  await expect.poll(() => toggles.length).toBe(2);
  expect(toggles[1]!.request().postDataJSON()).toEqual({ enabled });
  instance.enabled = enabled;
  await toggles[1]!.fulfill({ json: { ...instance } });
  await expect(rowToggle).toBeEnabled();
  await expect(rowToggle).toHaveJSProperty("checked", instance.enabled);
  await expect(installedRow.locator('[data-part="thumb"] [data-testid="extension-toggle-spinner"]')).toHaveCount(0);
  await expect(installedRow.getByRole("alert")).toHaveCount(0);
  await expect(installedRow.getByTestId("extension-row-upgrade")).toHaveCount(0);

  await installedRow.press("Enter");
  await detail.getByTestId("extension-delete").click();
  const confirmDelete = page.getByRole("dialog", { name: "Delete extension?" });
  const deleteData = confirmDelete.getByRole("checkbox", { name: /Also delete this extension/ });
  await deleteData.press("Space");
  await expect(deleteData).toBeChecked();
  const deleteButton = confirmDelete.getByRole("button", { name: "Delete", exact: true });
  await deleteButton.click();
  await expect.poll(() => deletions.length).toBe(1);
  expect(new URL(deletions[0]!.request().url()).searchParams.get("deleteUserData")).toBe("true");
  await expect(deleteButton).toBeDisabled();
  await deletions[0]!.abort("failed");
  await expect(confirmDelete.getByRole("alert")).toContainText("Failed to delete extension");
  await expect(deleteButton).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(confirmDelete).toBeHidden();
  await page.goBack();
  await expect(installedRow).toBeVisible();
  await expect(rowToggle).toBeDisabled();
  await page.locator('[data-status-bar-item="workbench.system-activity"]').click();
  const deletionRecovery = page
    .getByRole("alert")
    .filter({ has: page.getByText(`Delete ${catalog.displayName}`, { exact: true }) });
  await expect(deletionRecovery.getByRole("button", { name: "Copy draft" })).toBeEnabled();
  await expect(deletionRecovery.getByRole("button", { name: "Return to source" })).toBeEnabled();
  await deletionRecovery.getByRole("button", { name: "Discard draft" }).click();
  await expect(rowToggle).toBeDisabled();
  await expect(deletions).toHaveLength(1);
  await page.unrouteAll({ behavior: "ignoreErrors" });
});
