import { expect, test } from "../scripts/session-test";
import { createResourceActionsProject, prepareResourceActionsDashboard } from "./helpers/resource-actions";

// Authentication must not duplicate the empty surface or hide saved history in either placement.
test("native auth checking stays quiet and sign-in replaces only empty conversations in Main and Side", async ({
  page,
  request,
}) => {
  const project = await createResourceActionsProject(request);
  await prepareResourceActionsDashboard(page, project.id);
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let entered = false;
  await page.route("**/v1/agents/*/authentication?*", async (route) => {
    entered = true;
    await held;
    await route.fulfill({ json: { status: "signed_out", providers: [] } });
  });
  try {
    await page.goto(`/projects/${project.id}/extensions/pstdio.pstdio-session-browser/conversations/compose`);
    const main = page.locator('[data-workbench-region="main"]');
    const editor = main.locator('[data-testid="content-editable"][contenteditable="true"]');
    await expect.poll(() => entered).toBe(true);
    await expect(editor).toBeVisible();
    await editor.fill("Unsent during authentication");
    await expect(main.getByText("No messages yet", { exact: true })).toBeVisible();
    await expect(page.getByText("Checking harness authentication…", { exact: true })).toHaveCount(0);
    await expect(main.getByTestId("send-message-button")).toBeDisabled();
    release();
    await expect(main.getByRole("button", { name: "Sign in", exact: true })).toHaveCount(1);
    await expect(main.getByText("No messages yet", { exact: true })).toHaveCount(0);
    await expect(editor).toHaveText("Unsent during authentication");
    await page.getByRole("button", { name: "Show Side Panel", exact: true }).click();
    await page.locator('[data-workbench-panel-header="side"]').getByRole("button", { name: "Add panel" }).click();
    await page.getByRole("menuitem", { name: "New session", exact: true }).click();
    const side = page.locator('[data-workbench-region="side"]');
    await expect(side.getByRole("button", { name: "Sign in", exact: true })).toHaveCount(1);
    await expect(side.getByText("No messages yet", { exact: true })).toHaveCount(0);
    await expect(side.locator('[data-testid="content-editable"][contenteditable="true"]')).toBeVisible();
    const response = await request.post("/v1/sessions", {
      data: {
        project_id: project.id,
        title: "Retained auth history",
        prompt: "Saved before sign-out",
        agent: "pstdio.workbench-fixture.harness.fake",
      },
    });
    expect(response.ok()).toBe(true);
    const saved = await response.json();
    await expect
      .poll(async () => (await (await request.get(`/v1/sessions/${saved.id}`)).json()).status)
      .toBe("completed");
    const resource = encodeURIComponent(`pstdio://extension-resource/session/${saved.id}`);
    await page.goto(
      `/projects/${project.id}/extensions/pstdio.pstdio-session-browser/conversation?resource=${resource}`,
    );
    await expect(main.getByRole("button", { name: "Sign in", exact: true })).toHaveCount(1);
    await expect(main.locator("[data-chat-message-id]")).not.toHaveCount(0);
    await expect(main.getByText("Saved before sign-out", { exact: true })).toBeVisible();
    await expect(main.getByText("No messages yet", { exact: true })).toHaveCount(0);
  } finally {
    release();
    await page.unrouteAll({ behavior: "wait" });
    await request.delete(`/v1/projects/${project.id}`);
  }
});
