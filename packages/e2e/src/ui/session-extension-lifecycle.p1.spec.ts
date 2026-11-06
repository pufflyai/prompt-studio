import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import {
  createResourceActionsProject,
  openSessionSidePanel,
  prepareResourceActionsDashboard,
} from "./helpers/resource-actions";

// Critical risk: disabling a presentation provider must release its observers,
// preserve unsent work and leave execution, workspaces and Settings usable.
test("Sessions can be disabled and restored without losing drafts or stopping its agent", async ({ page, request }) => {
  const project = await createResourceActionsProject(request);
  let sessionId: string | undefined;
  try {
    const created = await request.post("/v1/sessions", {
      data: {
        project_id: project.id,
        title: "Retained execution",
        prompt: "Keep working __fake_hold__",
        agent: "pstdio.workbench-fixture.harness.fake",
      },
    });
    expect(created.ok()).toBe(true);
    sessionId = (await created.json()).id;
    const readSession = async () => (await request.get(`/v1/sessions/${sessionId}`)).json();
    await expect.poll(async () => (await readSession()).status).toBe("in_progress");
    await expect.poll(async () => Boolean((await readSession()).agent_session_id)).toBe(true);
    const before = await readSession();
    const listed = await (await request.get(`/v1/projects/${project.id}/extensions`)).json();
    const provider = listed.extensions.find(
      (entry: { installName: string }) => entry.installName === "pstdio-session-browser",
    );
    expect(provider).toBeTruthy();
    const watches: string[] = [];
    const holds: string[] = [];
    const deleted: string[] = [];
    let stops = 0;
    page.on("request", (sent) => {
      const path = new URL(sent.url()).pathname;
      if (path.endsWith("/subscriptions") && sent.method() === "POST") {
        const body = sent.postDataJSON();
        if (
          body.command?.command_id === "pstdio.pstdio-session-browser.command.watch" &&
          body.command.body.resource?.id === sessionId
        )
          watches.push(body.subscription_id);
        if (body.retain_session_id === sessionId) holds.push(body.subscription_id);
      }
      if (sent.method() === "DELETE" && path.includes("/session-stream/")) deleted.push(path.split("/").at(-1)!);
      if (path.endsWith("chat.onAction/execute") && sent.postDataJSON()?.params?.action?.type === "stop") stops++;
    });
    await prepareResourceActionsDashboard(page, project.id);
    const target = `/projects/${project.id}/extensions/pstdio.pstdio-session-browser/conversation?resource=${encodeURIComponent(`pstdio://extension-resource/session/${sessionId}`)}`;
    await page.goto(target);
    const main = page.locator('[data-workbench-region="main"]');
    const side = page.locator('[data-workbench-region="side"]');
    const editor = main.locator('[data-testid="content-editable"][contenteditable="true"]').filter({ visible: true });
    await expect(editor).toBeVisible();
    await openSessionSidePanel(page, "Retained execution");
    await expect(
      side.locator('[data-testid="content-editable"][contenteditable="true"]').filter({ visible: true }),
    ).toBeVisible();
    await expect.poll(() => watches.length).toBe(1);
    await expect.poll(() => holds.length).toBe(1);
    const saved = page.waitForResponse(
      (response) =>
        response.url().endsWith("conversation.chat.saveDraft/execute") &&
        response.request().postDataJSON()?.params?.draft?.attachments?.length === 1,
    );
    await editor.fill("Unsent work survives provider disablement");
    const chooser = page.waitForEvent("filechooser");
    await main.getByRole("button", { name: "Attach files", exact: true }).click();
    await (await chooser).setFiles({
      name: "retained.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("Durable attachment"),
    });
    expect((await saved).ok()).toBe(true);
    await expect(side.getByRole("button", { name: "Remove retained.txt", exact: true })).toBeVisible();
    const tabs = await side
      .locator("[data-workbench-tab]")
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-workbench-tab")));
    const disabled = await request.patch(`/v1/projects/${project.id}/extensions/${provider.id}`, {
      data: { enabled: false },
    });
    expect(disabled.ok()).toBe(true);
    await expect(page.getByRole("option", { name: "Sessions", exact: true })).toHaveCount(0);
    await expect(page.getByTestId("content-editable").filter({ visible: true })).toHaveCount(0);
    await expect.poll(() => [...watches, ...holds].every((id) => deleted.includes(id))).toBe(true);
    expect(stops).toBe(0);
    expect(await readSession()).toMatchObject({
      id: sessionId,
      status: "in_progress",
      agent_session_id: before.agent_session_id,
    });
    expect((await request.get(`/v1/sessions/${sessionId}/conversation`)).ok()).toBe(true);
    expect((await request.get(`/v1/workspaces/${before.workspace_id}`)).ok()).toBe(true);
    await page.getByRole("option", { name: "Settings", exact: true }).click();
    await expect(page.getByText("Appearance", { exact: true }).first()).toBeVisible();
    const enabled = await request.patch(`/v1/projects/${project.id}/extensions/${provider.id}`, {
      data: { enabled: true },
    });
    expect(enabled.ok()).toBe(true);
    await expect(page.getByRole("option", { name: "Sessions", exact: true })).toHaveCount(1);
    await expect(
      side.locator('[data-testid="content-editable"][contenteditable="true"]').filter({ visible: true }),
    ).toContainText("Unsent work survives provider disablement");
    await expect(side.getByRole("button", { name: "Remove retained.txt", exact: true })).toBeVisible();
    expect(
      await side
        .locator("[data-workbench-tab]")
        .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-workbench-tab"))),
    ).toEqual(tabs);
    await page.goBack();
    await expect(editor).toContainText("Unsent work survives provider disablement");
    await expect(main.getByRole("button", { name: "Remove retained.txt", exact: true })).toBeVisible();
    await expect.poll(() => watches.length).toBe(2);
    await expect.poll(() => holds.length).toBe(2);
    expect(new Set(watches).size).toBe(2);
    expect(stops).toBe(0);
    expect(await readSession()).toMatchObject({
      id: sessionId,
      status: "in_progress",
      agent_session_id: before.agent_session_id,
    });
    // The same held harness continues after presentation is restored, then exits normally.
    writeFileSync(join(before.cwd, ".fake-hold-release"), "release");
    await expect.poll(async () => (await readSession()).status).toBe("completed");
    expect((await readSession()).agent_session_id).toBe(before.agent_session_id);
  } finally {
    if (sessionId) await request.patch(`/v1/sessions/${sessionId}/status`, { data: { status: "cancelled" } });
    await request.delete(`/v1/projects/${project.id}`);
  }
});
