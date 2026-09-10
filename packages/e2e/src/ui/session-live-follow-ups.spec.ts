import { type APIRequestContext, expect, type Page, test } from "@playwright/test";
import { uiOrigin as apiBase } from "../ui-server";

const setup = async (page: Page, request: APIRequestContext) => {
  const project = await (await request.post(`${apiBase}/v1/projects`, { data: { name: "Live sessions" } })).json();
  const sessions: { id: string; title: string }[] = [];
  for (const title of ["Session A", "Session B"]) {
    const response = await request.post(`${apiBase}/v1/sessions`, {
      data: { project_id: project.id, title, prompt: title, agent: "pstdio.workbench-fixture.harness.fake" },
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
    if ((await draft.count()) === 0) await header.getByRole("button", { name: "Add panel", exact: true }).click();
    await draft.click();
    await page
      .getByRole("menu", { name: "New session menu", exact: true })
      .getByRole("menuitem", { name: session.title, exact: true })
      .click();
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

test("queues two follow-ups without stopping the active session and preserves a failed draft", async ({
  page,
  request,
}) => {
  const { header, sessions } = await setup(page, request);
  const session = sessions[1]!;
  const url = `${apiBase}/v1/sessions/${session.id}`;
  await request.patch(`${url}/status`, { data: { status: "in_progress" } });
  await expect(
    header.getByRole("tab", { name: session.title, exact: true }).locator('[aria-label="Session status: in_progress"]'),
  ).toBeVisible();
  const editor = page.locator('[data-testid="content-editable"][contenteditable="true"]').last();
  const send = page.getByTestId("send-message-button").last();
  for (const [index, prompt] of ["First waiting message", "Second waiting message"].entries()) {
    await editor.fill(prompt);
    await expect(send).toHaveAttribute("aria-label", "Queue message");
    const accepted = page.waitForResponse(
      (response) => response.url() === `${url}/follow-up` && response.request().method() === "POST",
    );
    if (index === 0) await editor.press("Enter");
    else await send.click();
    expect((await (await accepted).json()).follow_up.status).toBe("queued");
    await expect(editor).toBeEmpty();
    await expect(page.getByText(prompt, { exact: true })).toBeVisible();
    expect((await (await request.get(url)).json()).status).toBe("in_progress");
  }
  await page.reload();
  for (const prompt of ["First waiting message", "Second waiting message"])
    await expect(page.getByText(prompt, { exact: true })).toHaveCount(1);
  await page.route(`${url}/follow-up`, (route) =>
    route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "Could not send" }) }),
  );
  await editor.fill("Keep this draft");
  await send.click();
  await expect(editor).toHaveText("Keep this draft");
  await page.unroute(`${url}/follow-up`);
  await request.patch(`${url}/status`, { data: { status: "completed" } });
  await expect
    .poll(async () => {
      const body = await (await request.get(`${url}/conversation`)).json();
      return body.messages.filter(
        (message: { role: string; id: string }) => message.role === "user" && !message.id.startsWith("queued-prompt-"),
      ).length;
    })
    .toBe(3);
});
