import { expect, test } from "@playwright/test";
import { folderProjectInput } from "../helpers/folder-project";
import { uiOrigin } from "../ui-server";

for (const [harness, modes] of [
  ["native-modes", true],
  ["native-action", false],
] as const) {
  test(`uses ${harness} native command state across submission and reconnect`, async ({ page, request }) => {
    const project = process.env.E2E_COMMAND_PROJECT_ID
      ? { id: process.env.E2E_COMMAND_PROJECT_ID }
      : await (
          await request.post(`${uiOrigin}/v1/projects`, { data: folderProjectInput({ name: `Commands ${harness}` }) })
        ).json();
    const created = await request.post(`${uiOrigin}/v1/sessions`, {
      data: {
        project_id: project.id,
        title: "Native commands",
        prompt: "Hello",
        agent: `pstdio.workbench-fixture.harness.${harness}`,
        model: "fake",
      },
    });
    expect(created.ok()).toBe(true);
    const session = await created.json();
    const url = `${uiOrigin}/v1/sessions/${session.id}`;
    await expect.poll(async () => (await (await request.get(url)).json()).status).toBe("completed");
    await page.addInitScript(() => localStorage.setItem("onboarding-complete", "true"));
    const resource = encodeURIComponent(`pstdio://extension-resource/session/${session.id}`);
    await page.goto(`/projects/${project.id}/session?resource=${resource}`);
    const editor = page.locator('[data-testid="content-editable"][contenteditable="true"]').last();
    const send = page.getByTestId("send-message-button").last();
    await editor.fill("Finish the release notes /go");
    const menu = page.getByRole("listbox", { name: "Harness commands" });
    await expect(menu).toBeVisible();
    if (modes) await editor.press("Enter");
    else await menu.getByRole("option", { name: "/goal" }).click();
    await expect(editor).toHaveText("Finish the release notes ");
    await expect(page.getByRole("button", { name: "Remove Goal", exact: true })).toBeVisible();
    expect((await (await request.get(`${url}/harness-commands`)).json()).modes).toHaveLength(0);
    await send.click();
    await expect(editor).toBeEmpty();
    const controls = page.getByLabel("Harness controls", { exact: true });
    const goal = controls.getByRole("button", { name: "Goal details" });
    const expectObjective = async (objective: string) => {
      await expect(goal).toHaveText("Goal");
      await goal.hover();
      await expect(page.getByRole("tooltip")).toContainText(objective);
    };
    if (modes) {
      await expectObjective("Finish the release notes");
      await editor.fill("Review the design /pl");
      await menu.getByRole("option", { name: "/plan" }).click();
      await expect(controls.getByRole("button", { name: "Remove Plan" })).toBeVisible();
      await send.click();
      await expect(controls.getByRole("button", { name: "Plan details" })).toHaveText("Plan");
      await page.reload();
      await expect(controls.getByRole("button", { name: "Goal details" })).toBeVisible();
      await expect(controls.getByRole("button", { name: "Plan details" })).toBeVisible();
      await editor.fill("Keep this unsent draft");
      await controls.getByRole("button", { name: "Goal details" }).click();
      await page.getByRole("button", { name: "Edit", exact: true }).click();
      await page.getByRole("textbox", { name: "Objective" }).fill("Updated native objective");
      await page.getByRole("button", { name: "Apply", exact: true }).click();
      await expectObjective("Updated native objective");
      await expect(editor).toHaveText("Keep this unsent draft");
      await controls.getByRole("button", { name: "Goal details" }).click();
      await page.getByRole("button", { name: "Edit", exact: true }).click();
      await page.getByRole("textbox", { name: "Objective" }).fill("Stale edit");
      await request.post(`${url}/harness-commands`, {
        data: { operation: { kind: "command", text: "/goal External change" } },
      });
      await expectObjective("External change");
      await page.getByRole("button", { name: "Apply", exact: true }).click();
      await expect(
        page.getByText("The native mode changed. Review its current details before acting again."),
      ).toBeVisible();
      await expect(page.getByRole("textbox", { name: "Objective" })).toHaveValue("Stale edit");
      await expectObjective("External change");
      await page.getByRole("button", { name: "Cancel", exact: true }).click();
      await page.keyboard.press("Escape");
      await page.setViewportSize({ width: 600, height: 720 });
      await expect(send).toBeInViewport();
      await controls.getByRole("button", { name: "Clear goal" }).click();
      await expect(controls.getByRole("button", { name: "Goal details" })).toHaveCount(0);
      await expect(editor).toHaveText("Keep this unsent draft");
      await controls.getByRole("button", { name: "Leave planning" }).click();
      await expect(controls.getByRole("button", { name: "Plan details" })).toHaveCount(0);
      await page.setViewportSize({ width: 1280, height: 720 });
    } else {
      await expect(page.getByText("Native action completed")).toBeVisible();
      await expect(controls.getByRole("button", { name: /Native status is not confirmed/ })).toBeVisible();
      expect((await (await request.get(`${url}/harness-commands`)).json()).modes).toHaveLength(0);
    }
    await editor.fill("/unknown");
    await send.click();
    await expect(page.getByText("Command failed", { exact: true })).toBeVisible();
    await expect(editor).toHaveText("/unknown");
    await editor.fill("/fail");
    await send.click();
    await expect(editor).toHaveText("/fail");
    await expect(page.getByText(/Native command \/fail failed/)).toBeVisible();
  });
}
