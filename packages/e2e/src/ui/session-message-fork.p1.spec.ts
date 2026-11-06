import { expect, test } from "@playwright/test";
import { createResourceActionsProject, prepareResourceActionsDashboard } from "./helpers/resource-actions";

// A fork from the wrong reply silently includes context the user meant to leave behind.
test("the reply footer forks its own message and keeps failed copies available for retry", async ({
  page,
  request,
}) => {
  const project = await createResourceActionsProject(request);
  const response = await request.post("/v1/sessions", {
    data: {
      project_id: project.id,
      title: "Two approaches",
      prompt: "First approach",
      agent: "pstdio.workbench-fixture.harness.fake",
    },
  });
  const source = await response.json();
  await expect
    .poll(async () => (await (await request.get(`/v1/sessions/${source.id}`)).json()).status)
    .toBe("completed");
  const first = (await (await request.get(`/v1/sessions/${source.id}/conversation`)).json()).messages.find(
    (message: { role: string }) => message.role === "assistant",
  );
  await request.post(`/v1/sessions/${source.id}/follow-up`, { data: { prompt: "Second approach __fake_hold__" } });
  await expect
    .poll(async () => (await (await request.get(`/v1/sessions/${source.id}`)).json()).status)
    .toBe("in_progress");
  await prepareResourceActionsDashboard(page, project.id);
  await page.goto(`/projects/${project.id}/sessions`);
  await page
    .locator('[data-workbench-region="sidenav"]')
    .getByRole("option", { name: "Two approaches", exact: true })
    .click();
  const reply = page.locator(`[data-chat-message-id="${first.id}"]`);
  await reply.hover();
  const button = reply.getByRole("button", { name: "Fork conversation", exact: true });
  await expect(reply.getByRole("button", { name: "Copy message", exact: true })).toBeVisible();
  const commandId = "pstdio.pstdio-session-browser.view.conversation.chat.onAction";
  const actionRoute = `**/extensions/commands/${commandId}/execute`;
  let fail = true;
  let calls = 0;
  let forkId: string | undefined;
  await page.route(actionRoute, async (route) => {
    const action = route.request().postDataJSON().params.action;
    if (action.type !== "fork") return route.continue();
    calls++;
    expect(action.messageId).toBe(first.id);
    if (fail) {
      await route.fulfill({
        json: {
          commandId,
          extensionId: "pstdio.pstdio-session-browser",
          outcome: { ok: false, status: "error", error: { message: "Copy unavailable. Try again." }, notices: [] },
        },
      });
      return;
    }
    // Retry crosses the real public extension session fork service and navigation channel.
    const response = await route.fetch();
    const result = await response.json();
    expect(result.outcome.ok).toBe(true);
    expect(result.outcome.navigationRequests).toHaveLength(1);
    forkId = result.outcome.navigationRequests[0].resource.id;
    await route.fulfill({ response });
  });
  await button.focus();
  await page.keyboard.press("Enter");
  await expect(reply.getByRole("alert")).toContainText("Copy unavailable");
  await expect(page).toHaveURL(new RegExp(source.id));
  fail = false;
  await button.click();
  await expect.poll(() => forkId).toBeTruthy();
  await expect(page).toHaveURL(new RegExp(forkId!));
  expect(calls).toBe(2);
  expect((await (await request.get(`/v1/sessions/${source.id}`)).json()).status).toBe("in_progress");
  await request.post(`/v1/sessions/${source.id}/stop`);
});
