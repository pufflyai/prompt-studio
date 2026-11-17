import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { folderProjectInput } from "../helpers/folder-project";
import { switchSession } from "../helpers/session-side-panel";
import { type APIRequestContext, expect, type Page, type Request, test } from "../scripts/session-test";
import { uiOrigin as apiBase } from "../ui-server";

const commandId = "pstdio.session-browser.view.conversation.chat.onAction";
const actionRoute = `**/extensions/commands/${commandId}/execute`;
const isSubmit = (request: Request) =>
  request.method() === "POST" &&
  request.url().endsWith(`/extensions/commands/${commandId}/execute`) &&
  request.postDataJSON()?.params?.action?.type === "submit";

const setup = async (page: Page, request: APIRequestContext, prompts = ["Session A", "Session B"]) => {
  const project = await (
    await request.post(`${apiBase}/v1/projects`, { data: folderProjectInput({ name: "Live sessions" }) })
  ).json();
  const sessions: { id: string; title: string }[] = [];
  for (const [index, title] of ["Session A", "Session B"].entries()) {
    const response = await request.post(`${apiBase}/v1/sessions`, {
      data: { project_id: project.id, title, prompt: prompts[index], agent: "pstdio.workbench-fixture.harness.fake" },
    });
    expect(response.ok()).toBe(true);
    sessions.push(await response.json());
  }
  await expect
    .poll(async () => (await (await request.get(`${apiBase}/v1/sessions/${sessions[0]!.id}`)).json()).status)
    .toBe("completed");
  await page.addInitScript((projectId: string) => {
    localStorage.setItem("onboarding-complete", "true");
    localStorage.setItem("dashboard-wb2:selected-project:global", projectId);
  }, project.id);
  await page.goto(`/projects/${project.id}/`);
  await page.getByRole("button", { name: "Open Side Panel", exact: true }).click();
  await page.getByRole("button", { name: "Reattach Side Panel", exact: true }).click();
  const header = page.locator('[data-workbench-panel-header="side"]');
  for (const session of sessions) {
    const draft = header.getByRole("tab", { name: "New session", exact: true });
    if ((await draft.count()) === 0) {
      await header.getByRole("button", { name: "Add panel", exact: true }).click();
      await page.getByRole("menuitem", { name: "New session", exact: true }).click();
    }
    await draft.click({ button: "right" });
    await switchSession(page, session.title);
  }
  return { header, sessions };
};

test("updates active and inactive session tab indicators from live state", async ({ page, request }) => {
  const { header, sessions } = await setup(page, request);
  const tab = header.getByRole("tab", { name: "Session A", exact: true });
  const other = header.getByRole("tab", { name: "Session B", exact: true });
  for (const active of [false, true]) {
    if (active) await tab.click();
    for (const status of ["in_progress", "awaiting_input", "failed", "cancelled", "disconnected", "completed"]) {
      const response = await request.patch(`${apiBase}/v1/sessions/${sessions[0]!.id}/status`, { data: { status } });
      expect(response.ok()).toBe(true);
      await expect(tab.locator(`[aria-label="Session status: ${status}"]`)).toBeVisible();
      await expect(other.locator('[aria-label="Session status: completed"]')).toBeVisible();
    }
  }
});

test("queues two follow-ups without stopping the active session and keeps a failed message recoverable", async ({
  page,
  request,
}) => {
  // The fake agent keeps Session B's run active until the test releases it.
  const { header, sessions } = await setup(page, request, ["Session A", "Session B __fake_hold__"]);
  const session = sessions[1]!;
  const url = `${apiBase}/v1/sessions/${session.id}`;
  await expect(
    header.getByRole("tab", { name: session.title, exact: true }).locator('[aria-label="Session status: in_progress"]'),
  ).toBeVisible();
  const editor = page.getByTestId("content-editable").last();
  const send = page.getByTestId("send-message-button").last();
  for (const [index, prompt] of ["First waiting message", "Second waiting message"].entries()) {
    await editor.fill(prompt);
    await expect(send).toHaveAttribute("aria-label", "Queue message");
    const accepted = page.waitForResponse((response) => isSubmit(response.request()));
    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    let submits = 0;
    await page.route(actionRoute, async (route) => {
      if (isSubmit(route.request())) {
        submits++;
        expect(route.request().postDataJSON().params.renderer.resource.id).toBe(session.id);
        await held;
      }
      await route.continue();
    });
    if (index === 0) await editor.press("Enter");
    else await send.click();
    try {
      await expect(editor).toBeEmpty();
      await expect(page.getByText(prompt, { exact: true })).toHaveCount(1);
      await expect(page.locator("[data-queued-follow-up-id]").filter({ hasText: prompt })).toBeVisible();
      await expect(editor).toHaveAttribute("contenteditable", "false");
      await expect(send).toBeDisabled();
    } finally {
      release();
    }
    expect((await (await accepted).json()).outcome.ok).toBe(true);
    expect(submits).toBe(1);
    await page.unroute(actionRoute);
    await expect(editor).toHaveAttribute("contenteditable", "true");
    await expect(editor).toBeEmpty();
    await expect(page.getByText(prompt, { exact: true })).toBeVisible();
    // The saved request replaces the sending row, so it can be edited.
    await expect(page.getByRole("button", { name: `Edit queued message: ${prompt}`, exact: true })).toBeEnabled();
    expect((await (await request.get(url)).json()).status).toBe("in_progress");
  }
  await page.reload();
  for (const prompt of ["First waiting message", "Second waiting message"])
    await expect(page.getByText(prompt, { exact: true })).toHaveCount(1);
  await page.route(actionRoute, (route) => {
    if (!isSubmit(route.request())) return route.continue();
    expect(route.request().postDataJSON().params.renderer.resource.id).toBe(session.id);
    return route.fulfill({
      json: {
        commandId,
        extensionId: "pstdio.session-browser",
        outcome: {
          ok: false,
          status: "error",
          reason: "Could not send",
          error: { message: "Could not send" },
          notices: [],
        },
      },
    });
  });
  await editor.fill("Keep this draft");
  await expect(send).toHaveAttribute("aria-label", "Queue message");
  await send.click();
  // The failed message stays in the conversation; closing it puts the text back in the composer.
  await expect(page.getByText("Message not sent")).toBeVisible();
  await expect(editor).toBeEmpty();
  await page.getByRole("button", { name: "Dismiss" }).click();
  await expect(page.getByText("Message not sent")).toHaveCount(0);
  await expect(editor).toHaveText("Keep this draft");
  await page.unroute(actionRoute);
  await send.click();
  await expect(editor).toBeEmpty();
  await expect(page.getByText("Keep this draft", { exact: true })).toHaveCount(1);
  await expect(editor).toBeFocused();
  writeFileSync(join((await (await request.get(url)).json()).cwd, ".fake-hold-release"), "");
  await expect
    .poll(async () => {
      const body = await (await request.get(`${url}/conversation`)).json();
      return body.messages.filter(
        (message: { role: string; id: string }) => message.role === "user" && !message.id.startsWith("queued-prompt-"),
      ).length;
    })
    .toBe(4);
});
