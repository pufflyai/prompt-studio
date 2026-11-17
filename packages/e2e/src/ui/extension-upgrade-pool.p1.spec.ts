import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { expect, type Route, test } from "@playwright/test";
import type { ProjectExtensionInstance } from "@pstdio/sdk/api";
import { folderProjectInput } from "../helpers/folder-project";
import { uiOrigin } from "../ui-server";

test("upgrade all respects host capacity across list and detail and immediately applies a single result", async ({
  page,
  request,
}) => {
  const dir = join(process.env.E2E_HOME!, `upgrade-pool-${Date.now()}`);
  mkdirSync(dir, { recursive: true });
  const created = await request.post(`${uiOrigin}/v1/projects`, {
    data: folderProjectInput({ name: "Upgrade pool" }, dir),
  });
  expect(created.ok()).toBe(true);
  const { id } = await created.json();
  const inventoryPath = `/v1/projects/${id}/extensions`;
  const inventory = await (await request.get(uiOrigin + inventoryPath)).json();
  const targets = (inventory.extensions as ProjectExtensionInstance[])
    .slice(0, 3)
    .map((row) => ({ ...row, canUpgrade: true }));
  expect(targets).toHaveLength(3);
  const requests: Route[] = [];
  const heldReads: Route[] = [];
  let delayReads = false;
  await page.route(`**${inventoryPath}`, async (route) => {
    if (delayReads) heldReads.push(route);
    else await route.fulfill({ json: { ...inventory, extensions: targets, upgradeConcurrency: 2 } });
  });
  await page.route(`**${inventoryPath}/*/upgrade`, (route) => {
    requests.push(route);
  });
  await page.addInitScript((project) => {
    localStorage.setItem("onboarding-complete", "true");
    localStorage.setItem("dashboard-wb2:selected-project:global", project);
  }, id);
  await page.goto(`/projects/${id}`);
  await page.getByRole("option", { name: "Extensions", exact: true }).click();
  await page.getByTestId("extensions-upgrade-all").click();
  await expect.poll(() => requests.length).toBe(2);
  const waiting = page.getByRole("button", { name: "Waiting to upgrade", exact: true });
  await expect(waiting).toBeDisabled();
  const waitingRow = page.getByTestId("extension-entry").filter({ has: waiting });
  await waitingRow.click();
  await expect(page.getByTestId("extension-upgrade")).toBeDisabled();
  await page.goBack();
  await expect(waiting).toBeDisabled();
  const complete = async (route: Route) => {
    const instanceId = new URL(route.request().url()).pathname.split("/").at(-2);
    const target = targets.find((row) => row.id === instanceId)!;
    await route.fulfill({ json: { changed: true, extension: { ...target, version: "9.9.9", canUpgrade: false } } });
    return target;
  };
  delayReads = true;
  try {
    const first = await complete(requests[0]!);
    await expect.poll(() => requests.length).toBe(3);
    await expect(
      page.getByTestId("extension-entry").filter({ hasText: first.displayName }).getByTestId("extension-row-upgrade"),
    ).toHaveCount(0);
    await Promise.all(requests.slice(1).map(complete));
    await expect(page.getByTestId("extension-row-upgrade")).toHaveCount(0);
  } finally {
    delayReads = false;
    await Promise.all(heldReads.map((route) => route.abort().catch(() => {})));
  }
});
