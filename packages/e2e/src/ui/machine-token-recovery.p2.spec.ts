import { expect, test } from "@playwright/test";
import { folderProjectInput } from "../helpers/folder-project";

test("keeps an unconfirmed issuance blocked and restores its fields after reopening Settings", async ({
  page,
  request,
}) => {
  const before = await (await request.get("/v1/settings")).json();
  const enabled = await request.patch("/v1/settings", { data: { machine_tokens_enabled: true } });
  expect(enabled.ok()).toBe(true);
  const created = await request.post("/v1/projects", { data: folderProjectInput({ name: "Machine token recovery" }) });
  expect(created.ok()).toBe(true);
  const { id } = (await created.json()) as { id: string };
  const owner = "Team automation";
  const scope = "pstdio.planner.command.start-attempt";
  let writes = 0;
  const requestEntered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  await page.route("**/v1/auth/tokens", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    writes++;
    requestEntered.resolve();
    await release.promise;
    await route.abort("failed");
  });
  await page.addInitScript((projectId: string) => {
    localStorage.setItem("onboarding-complete", "true");
    localStorage.setItem("dashboard-wb2:selected-project:global", projectId);
  }, id);

  try {
    await page.goto(`/projects/${id}`);
    await page.getByRole("option", { name: "Settings", exact: true }).click();
    await page.getByText("Machine tokens", { exact: true }).first().click();
    const ownerField = page.getByRole("textbox", { name: "Owner and purpose" });
    const scopeField = page.getByRole("textbox", { name: "Allowed command IDs" });
    const issue = page.getByRole("button", { name: "Issue token", exact: true });
    await ownerField.fill(owner);
    await scopeField.fill(scope);
    await scopeField.blur();
    await expect(issue).toBeEnabled();
    await issue.click();
    await requestEntered.promise;
    await expect(issue).toBeDisabled();
    release.resolve();

    await expect(page.getByText("Token issuance could not be confirmed.", { exact: true })).toBeVisible();
    await expect(issue).toBeDisabled();
    await page.keyboard.press("Escape");
    await expect(issue).toBeHidden();
    await page.locator('[data-status-bar-item="workbench.system-activity"]').click();
    await page.getByRole("button", { name: "Return to source", exact: true }).click();
    await expect(ownerField).toHaveValue(owner);
    await expect(scopeField).toHaveValue(scope);
    await expect(issue).toBeDisabled();
    expect(writes).toBe(1);
  } finally {
    release.resolve();
    await request.delete(`/v1/projects/${id}`);
    await request.patch("/v1/settings", { data: { machine_tokens_enabled: before.machine_tokens_enabled } });
  }
});
