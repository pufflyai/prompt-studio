import { expect, test } from "@playwright/test";
import { folderProjectInput } from "../helpers/folder-project";
import { uiOrigin } from "../ui-server";

test("native plan approval preserves the draft and leaves planning in the same thread", async ({ page, request }) => {
  const project = process.env.E2E_COMMAND_PROJECT_ID
    ? { id: process.env.E2E_COMMAND_PROJECT_ID }
    : await (
        await request.post(`${uiOrigin}/v1/projects`, { data: folderProjectInput({ name: "Plan approval" }) })
      ).json();
  const created = await request.post(`${uiOrigin}/v1/sessions`, {
    data: {
      project_id: project.id,
      title: "Plan approval",
      prompt: "Hello",
      agent: "pstdio.workbench-fixture.harness.native-modes",
      model: "fake",
    },
  });
  expect(created.ok()).toBe(true);
  const session = await created.json();
  const url = `${uiOrigin}/v1/sessions/${session.id}`;
  const state = async () => (await request.get(url)).json();
  await expect.poll(async () => (await state()).status).toBe("completed");
  const thread = (await state()).agent_session_id;
  const propose = async (text: string) => {
    const response = await request.post(`${url}/harness-commands`, {
      data: { operation: { kind: "command", text: `/plan ${text}` } },
    });
    expect(response.ok()).toBe(true);
  };
  await propose("# Release workflow\n\n1. Update shared controls.\n2. Validate native state.");
  await page.addInitScript(() => localStorage.setItem("onboarding-complete", "true"));
  const resource = encodeURIComponent(`pstdio://extension-resource/session/${session.id}`);
  await page.goto(`/projects/${project.id}/session?resource=${resource}`);
  const dialog = page.getByRole("dialog", { name: "Approve plan" });
  const approve = dialog.getByRole("button", { name: "Approve and implement" });
  const editor = page.locator('[data-testid="content-editable"][contenteditable="true"]').last();
  const controls = page.getByLabel("Harness controls", { exact: true });
  await expect(dialog.getByRole("heading", { name: "Release workflow" })).toBeVisible();
  await dialog.getByRole("button", { name: "Keep planning" }).click();
  await expect(dialog).toBeHidden();
  expect((await state()).params_json?.planning).toBe(true);
  await editor.fill("Keep this unsent draft");
  await controls.getByRole("button", { name: "Plan details" }).click();
  await page.getByRole("button", { name: "Approve and implement" }).click();
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(editor).toHaveText("Keep this unsent draft");
  await page.reload();
  await expect(dialog).toBeVisible();
  await expect(editor).toHaveText("Keep this unsent draft");
  const failApproval = async (route: import("@playwright/test").Route) => {
    if (route.request().method() === "POST")
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "Provider unavailable" }),
      });
    else await route.continue();
  };
  await page.route("**/harness-commands", failApproval);
  await approve.click();
  await expect(dialog.getByText("Action failed", { exact: true })).toBeVisible();
  await expect(dialog).toBeVisible();
  await expect(editor).toHaveText("Keep this unsent draft");
  await dialog.getByRole("button", { name: "Dismiss" }).click();
  await page.unroute("**/harness-commands", failApproval);
  await propose("# Revised workflow\n\nUse the revised native plan.");
  await expect(dialog.getByRole("heading", { name: "Revised workflow" })).toBeVisible();
  await approve.click();
  await expect(dialog).toBeHidden();
  await expect(controls.getByRole("button", { name: "Plan details" })).toHaveCount(0);
  await expect.poll(async () => (await state()).status).toBe("completed");
  const implemented = await state();
  expect(implemented.agent_session_id).toBe(thread);
  expect(implemented.params_json?.planning).toBe(false);
  await expect(editor).toHaveText("Keep this unsent draft");
});
