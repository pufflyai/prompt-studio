import { expect, test } from "@playwright/test";
import { folderProjectInput } from "../helpers/folder-project";
import { uiOrigin } from "../ui-server";

test("inline plan choices preserve the draft and attachments while implementation leaves planning", async ({
  page,
  request,
}) => {
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
    expect(
      (
        await request.post(`${url}/harness-commands`, {
          data: { operation: { kind: "command", text: `/plan ${text}` } },
        })
      ).ok(),
    ).toBe(true);
  };
  await propose("# Release workflow\n\n1. Update shared controls.\n2. Validate native state.");
  await page.addInitScript(() => localStorage.setItem("onboarding-complete", "true"));
  const resource = encodeURIComponent(`pstdio://extension-resource/session/${session.id}`);
  await page.goto(`/projects/${project.id}/session?resource=${resource}`);
  const approve = page.getByRole("radio", { name: "Approve and implement", exact: true });
  const send = page.locator('[data-testid="send-message-button"]:visible').last();
  const editor = page.locator('[data-testid="content-editable"][contenteditable="true"]:visible').last();
  const controls = page.getByLabel("Harness controls", { exact: true });
  const reopen = async () => {
    await controls.getByRole("button", { name: "Plan details" }).click();
    await page.getByRole("button", { name: "Approve and implement", exact: true }).click();
    await expect(approve).toBeVisible();
  };
  await expect(approve).toBeVisible();
  await expect(send).toBeDisabled();
  await page.getByText("Keep planning", { exact: true }).click();
  await send.click();
  await expect(editor).toBeVisible();
  expect((await state()).params_json?.planning).toBe(true);
  await editor.fill("Keep this unsent draft");
  await reopen();
  await page.getByRole("button", { name: "Skip", exact: true }).click();
  await expect(editor).toHaveText("Keep this unsent draft");
  await page.reload();
  await expect(approve).toBeVisible();
  await page.getByRole("button", { name: "Skip", exact: true }).click();
  await expect(editor).toHaveText("Keep this unsent draft");
  await page
    .locator('input[type="file"]')
    .last()
    .setInputFiles({
      name: "draft-context.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("Context for the unsent message."),
    });
  await expect(page.getByText("draft-context.txt", { exact: true })).toBeVisible();
  await reopen();
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
  await page.getByLabel("Question form").getByText("Approve and implement", { exact: true }).click();
  await send.click();
  await expect(page.getByText("Command failed", { exact: true })).toBeVisible();
  await expect(approve).toBeChecked();
  await expect(page.getByText("draft-context.txt", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Dismiss", exact: true }).click();
  await page.unroute("**/harness-commands", failApproval);
  await propose("# Revised workflow\n\nUse the revised native plan.");
  await controls.getByRole("button", { name: "Plan details" }).hover();
  await expect(page.getByRole("tooltip")).toContainText("Revised workflow");
  await page.mouse.move(0, 0);
  await expect(page.getByRole("tooltip")).toBeHidden();
  await expect(send).toBeDisabled();
  await page.getByText("Keep planning", { exact: true }).click();
  await send.click();
  await expect(editor).toHaveText("Keep this unsent draft");
  await reopen();
  await page.getByLabel("Question form").getByText("Approve and implement", { exact: true }).click();
  await send.click();
  await expect(controls.getByRole("button", { name: "Plan details" })).toHaveCount(0);
  await expect.poll(async () => (await state()).status).toBe("completed");
  const implemented = await state();
  expect(implemented.agent_session_id).toBe(thread);
  expect(implemented.params_json?.planning).toBe(false);
  await expect(editor).toHaveText("Keep this unsent draft");
  await expect(page.getByText("draft-context.txt", { exact: true })).toBeVisible();
});
