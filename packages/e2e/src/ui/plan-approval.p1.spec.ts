import { folderProjectInput } from "../helpers/folder-project";
import { isSessionChatAction, sessionChatActionRoute } from "../helpers/session-chat-actions";
import { expect, test } from "../scripts/session-test";
import { uiOrigin } from "../ui-server";

test("plan actions take over the composer and restore its draft without sending it", async ({ page, request }) => {
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
  await page.addInitScript((projectId: string) => {
    localStorage.setItem("onboarding-complete", "true");
    localStorage.setItem("dashboard-wb2:selected-project:global", projectId);
  }, project.id);
  const resource = encodeURIComponent(`pstdio://extension-resource/session/${session.id}`);
  await page.goto(`/projects/${project.id}/session?resource=${resource}`);
  const decision = page.getByLabel("Plan decision", { exact: true }).filter({ visible: true });
  const editor = page.locator('[data-testid="content-editable"][contenteditable="true"]:visible').last();
  const controls = page.getByLabel("Harness controls", { exact: true }).filter({ visible: true });
  const reopen = async () => {
    await controls.getByRole("button", { name: "Plan details" }).click();
    await page.getByRole("button", { name: "Approve and implement", exact: true }).click();
    await expect(decision).toBeVisible();
  };
  await expect(decision).toBeVisible();
  await expect(decision.getByText("fake", { exact: true })).toBeVisible();
  await decision.getByRole("button", { name: "Continue planning", exact: true }).click();
  await expect(editor).toBeVisible();
  expect((await state()).params_json?.planning).toBe(true);
  await editor.fill("Keep this unsent draft");
  await reopen();
  await expect(editor).toBeHidden();
  await decision.getByRole("button", { name: "Skip", exact: true }).click();
  await expect(editor).toHaveText("Keep this unsent draft");
  await page.reload();
  await expect(decision).toBeVisible();
  await decision.getByRole("button", { name: "Skip", exact: true }).click();
  await expect(editor).toHaveText("Keep this unsent draft");
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Attach files", exact: true }).click();
  await (await chooser).setFiles({
    name: "draft-context.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("Context for the unsent message."),
  });
  await expect(page.getByText("draft-context.txt", { exact: true })).toBeVisible();
  await reopen();
  let rejectedApprovals = 0;
  const failApproval = async (route: import("@playwright/test").Route) => {
    if (
      isSessionChatAction(route.request(), "decision") &&
      route.request().postDataJSON().params.action.actionId === "approve"
    ) {
      rejectedApprovals++;
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "Provider unavailable" }),
      });
    } else await route.continue();
  };
  await page.route(sessionChatActionRoute, failApproval);
  await decision.getByRole("button", { name: "Approve and implement", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Provider unavailable");
  expect(rejectedApprovals).toBe(1);
  await expect(decision).toBeVisible();
  await page.unroute(sessionChatActionRoute, failApproval);
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(decision).toBeVisible();
  await propose("# Revised workflow\n\nUse the revised native plan.");
  await controls.getByRole("button", { name: "Plan details" }).hover();
  await expect(page.getByRole("tooltip")).toContainText("Revised workflow");
  await page.mouse.move(0, 0);
  await expect(page.getByRole("tooltip")).toBeHidden();
  await decision.getByRole("button", { name: "Continue planning", exact: true }).click();
  await expect(editor).toHaveText("Keep this unsent draft");
  await expect(page.getByText("draft-context.txt", { exact: true })).toBeVisible();
  await reopen();
  await decision.getByRole("button", { name: "Approve and implement", exact: true }).click();
  await expect(controls.getByRole("button", { name: "Plan details" })).toHaveCount(0);
  await expect.poll(async () => (await state()).status).toBe("completed");
  const implemented = await state();
  expect(implemented.agent_session_id).toBe(thread);
  expect(implemented.params_json?.planning).toBe(false);
  await expect(editor).toHaveText("Keep this unsent draft");
  await expect(page.getByText("draft-context.txt", { exact: true })).toBeVisible();
  await page.screenshot({ path: test.info().outputPath("draft-restored.png") });
});
