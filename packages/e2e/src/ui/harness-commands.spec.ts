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
    await editor.fill("/");
    const menu = page.getByRole("listbox", { name: "Harness commands" });
    await expect(menu).toBeVisible();
    await menu.getByRole("option", { name: "/goal" }).click();
    await expect(editor).toHaveText("/goal ");
    expect((await (await request.get(`${url}/harness-commands`)).json()).modes).toHaveLength(0);
    await send.click();
    await expect(editor).toBeEmpty();
    const controls = page.getByLabel("Harness controls", { exact: true });
    if (modes) {
      await expect(controls.getByText("Goal", { exact: true })).toBeVisible();
      await request.post(`${url}/harness-commands`, { data: { operation: { kind: "command", text: "/plan" } } });
      await expect(controls.getByText("Planning", { exact: true })).toBeVisible();
      await page.reload();
      await expect(controls.getByText("Goal", { exact: true })).toBeVisible();
      await expect(controls.getByText("Planning", { exact: true })).toBeVisible();
      await controls.getByRole("button", { name: "Clear goal" }).click();
      await expect(controls.getByText("Goal", { exact: true })).toHaveCount(0);
    } else {
      await expect(page.getByText("Native action completed")).toBeVisible();
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
    await editor.fill("/goal");
    await page.getByRole("button", { name: "Run native command", exact: true }).click();
    await send.click();
    await expect.poll(async () => (await (await request.get(url)).json()).status).toBe("completed");
    const conversation = await (await request.get(`${url}/conversation`)).json();
    expect(
      conversation.messages.some(
        (message: { role: string; parts: { type: string; text?: string }[] }) =>
          message.role === "user" && message.parts.some((part) => part.text === "/goal"),
      ),
    ).toBe(true);
  });
}
