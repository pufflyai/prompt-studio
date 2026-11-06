import { expect, test } from "@playwright/test";
import {
  type RemoteSessionBrowserFixture,
  startRemoteSessionBrowserFixture,
} from "../helpers/remote-session-browser-fixture";

let fixture: RemoteSessionBrowserFixture;
let fixtureProcess: ReturnType<typeof startRemoteSessionBrowserFixture>;
test.beforeAll(async () => {
  fixtureProcess = startRemoteSessionBrowserFixture();
  fixture = await fixtureProcess.ready;
});
test.afterAll(async () => {
  if (!fixtureProcess) return;
  const output = await fixtureProcess.stop();
  await test.info().attach("remote-fixture.log", { body: output, contentType: "text/plain" });
});
const sessionUrl = () =>
  `${fixture.origin}/projects/${fixture.projectId}/session?resource=${encodeURIComponent(`pstdio://extension-resource/session/${fixture.sessionId}`)}`;

test("remote primary controls keep commands, queues, questions and approvals on their online owner", async ({
  page,
  request,
}) => {
  const main = page.locator('[data-workbench-panel="main"]');
  await page.addInitScript((projectId: string) => {
    localStorage.setItem("onboarding-complete", "true");
    localStorage.setItem("dashboard-wb2:selected-project:global", projectId);
  }, fixture.projectId);
  // Availability is read server-side through the public session owner service.
  await request.post(`${fixture.origin}/fixture/action`, { data: { action: "hold-presence" } });
  try {
    await page.goto(sessionUrl());
    await expect(main.getByRole("button", { name: "Check connection", exact: true })).toBeVisible();
    await expect(main.getByText(/Laptop is offline/).filter({ visible: true })).toHaveCount(0);
    await expect(main.getByRole("button", { name: "Stop Response", exact: true })).toHaveCount(0);
  } finally {
    await request.post(`${fixture.origin}/fixture/action`, { data: { action: "release-presence" } });
  }
  const editor = main.locator('[data-testid="content-editable"][contenteditable="true"]').filter({ visible: true });
  const send = main.getByTestId("send-message-button").filter({ visible: true });
  await expect(main.getByText("Working on Laptop.", { exact: true }).filter({ visible: true }).first()).toBeVisible();
  await expect(main.getByRole("button", { name: "Select device", exact: true })).toHaveCount(0);
  await expect(editor).toHaveAttribute("contenteditable", "true");
  await expect(main.getByText("Working on Laptop.", { exact: true }).filter({ visible: true }).first()).toBeVisible();
  await editor.fill("Queued from the browser");
  // The initial stream can carry a saved read-only queue before the owner read recovers.
  // Select the actual queue action, not the same toolbar button while it still means Stop.
  await main.getByRole("button", { name: "Queue message", exact: true }).click();
  const queued = main.getByRole("button", { name: "Edit queued message: Queued from the browser", exact: true });
  await expect(queued).toBeVisible();
  await queued.click();
  await editor.fill("Edited from the browser");
  await main.getByRole("button", { name: "Update", exact: true }).click();
  await expect(
    main.getByRole("button", { name: "Edit queued message: Edited from the browser", exact: true }),
  ).toBeVisible();
  const state = async () => (await request.get(`${fixture.origin}/fixture/state`)).json();
  await expect.poll(async () => (await state()).queue[0]?.prompt).toBe("Edited from the browser");
  await main.getByRole("button", { name: "Remove queued follow-up", exact: true }).click();
  await expect.poll(async () => (await state()).queue).toEqual([]);
  await request.post(`${fixture.origin}/fixture/action`, { data: { action: "queue-unavailable" } });
  await page.goto(sessionUrl());
  await expect(main.getByRole("button", { name: "Refresh queue", exact: true })).toBeVisible();
  await request.post(`${fixture.origin}/fixture/action`, { data: { action: "question" } });
  await expect(main.getByRole("radio", { name: "Blue", exact: true })).toBeVisible();
  await main.getByRole("form", { name: "Question form" }).getByText("Blue", { exact: true }).click();
  await expect(main.getByRole("radio", { name: "Blue", exact: true })).toBeChecked();
  await send.click();
  await expect.poll(async () => (await state()).answers).toEqual([{ callId: "remote-question", answers: [["Blue"]] }]);
  await request.post(`${fixture.origin}/fixture/action`, { data: { action: "approval" } });
  await main.getByRole("button", { name: "Allow", exact: true }).click();
  await expect.poll(async () => (await state()).approvals).toEqual([{ id: "remote-approval", decision: "approve" }]);
  await main.getByRole("button", { name: "Stop Response", exact: true }).click();
  await expect.poll(async () => (await state()).stops).toEqual([fixture.sessionId]);
  const after = await state();
  expect(after.sourceSessions).toEqual([]);
  expect(after.targetSessions.find((session: { id: string }) => session.id === fixture.unrelatedId).status).toBe(
    "in_progress",
  );
  await request.post(`${fixture.origin}/fixture/action`, { data: { action: "queue-available" } });
  await page.goto(sessionUrl());
  await expect(main.getByRole("button", { name: "Refresh queue", exact: true })).toHaveCount(0);
  await expect(editor).toHaveAttribute("contenteditable", "true");
  await editor.fill("Resume on Laptop");
  await send.click();
  await expect
    .poll(
      async () =>
        (await state()).targetSessions.find((session: { id: string }) => session.id === fixture.sessionId).status,
    )
    .toBe("in_progress");
  await expect(main.getByRole("button", { name: "Stop Response", exact: true })).toBeVisible();
  await page.screenshot({ path: test.info().outputPath("online-owner.png") });
});

test("an online owner's queue recovers by itself after its automatic refresh also fails", async ({ page, request }) => {
  const main = page.locator('[data-workbench-panel="main"]');
  await page.addInitScript((projectId: string) => {
    localStorage.setItem("onboarding-complete", "true");
    localStorage.setItem("dashboard-wb2:selected-project:global", projectId);
  }, fixture.projectId);
  // Fail the real owner relay read, so public queue readers use their saved read-only checkpoint.
  const initial = await (await request.get(`${fixture.origin}/fixture/state`)).json();
  await request.post(`${fixture.origin}/fixture/action`, { data: { action: "queue-unavailable" } });
  await page.goto(sessionUrl());
  await expect(main.getByRole("button", { name: "Refresh queue", exact: true })).toBeVisible();
  // The first read and the automatic refresh both fail; a third read proves the session keeps asking.
  await expect
    .poll(async () => {
      const state = await (await request.get(`${fixture.origin}/fixture/state`)).json();
      return state.failedQueueReads - initial.failedQueueReads;
    })
    .toBeGreaterThanOrEqual(3);
  const draft = main.locator('[data-testid="content-editable"][contenteditable="true"]').filter({ visible: true });
  await draft.fill("Keep queue recovery draft");
  await request.post(`${fixture.origin}/fixture/action`, { data: { action: "queue-available" } });
  await expect(main.getByRole("button", { name: "Refresh queue", exact: true })).toHaveCount(0);
  await expect(main.getByTestId("send-message-button").filter({ visible: true })).toBeVisible();
  await expect(draft).toHaveText("Keep queue recovery draft");
});

test("remote workspaces open synced history; offline sessions stay readable and new drafts choose a device", async ({
  page,
  request,
}) => {
  const main = page.locator('[data-workbench-panel="main"]');
  await page.addInitScript((projectId: string) => {
    localStorage.setItem("onboarding-complete", "true");
    localStorage.setItem("dashboard-wb2:selected-project:global", projectId);
    localStorage.setItem(
      `pstdio-dashboard:command-params:recent-harness:${projectId}`,
      JSON.stringify({ harnessId: "pstdio.pstdio-browser-remote.harness.browser-remote" }),
    );
  }, fixture.projectId);
  await page.goto(sessionUrl());
  const fileRequests: string[] = [];
  page.on("request", (request) => {
    if (
      request.url().includes(`/v1/workspaces/${fixture.workspaceId}/`) &&
      /\/(files|file|diff)(\?|$)/.test(request.url())
    )
      fileRequests.push(request.url());
  });
  await main.getByRole("button", { name: "Open workspace", exact: true }).click();
  await expect(page).toHaveURL(/\/extensions\/pstdio\.pstdio-workspaces\/history\?/);
  await expect(
    page
      .getByRole("region", { name: "Main", exact: true })
      .getByRole("option")
      .filter({ hasText: "Remote conversation" }),
  ).toBeVisible();
  await expect(page.getByRole("tab", { name: "Changes", exact: true })).toHaveCount(0);
  expect(fileRequests).toEqual([]);
  const queuedResponse = await request.post(`${fixture.origin}/v1/sessions/${fixture.sessionId}/follow-up`, {
    data: { prompt: "Readable offline queue" },
  });
  expect(queuedResponse.ok()).toBe(true);
  // An incomplete saved queue must not hide essential controls for an online owner.
  await request.post(`${fixture.origin}/fixture/action`, { data: { action: "queue-unavailable" } });
  await page.goto(sessionUrl());
  await expect(main.getByRole("button", { name: "Refresh queue", exact: true })).toBeVisible();
  await expect(
    main.getByRole("button", { name: "Edit queued message: Readable offline queue", exact: true }),
  ).toHaveCount(0);
  await expect(main.getByText(/Laptop is offline/).filter({ visible: true })).toHaveCount(0);
  await expect(
    main.locator('[data-testid="content-editable"][contenteditable="true"]').filter({ visible: true }),
  ).toHaveAttribute("contenteditable", "true");
  await main
    .locator('[data-testid="content-editable"][contenteditable="true"]')
    .filter({ visible: true })
    .fill("Keep this draft while refreshing");
  await expect(main.getByRole("button", { name: "Stop Response", exact: true })).toBeVisible();
  await expect(main.getByRole("button", { name: "Open workspace", exact: true })).toBeVisible();
  await main.locator('[data-testid="content-editable"][contenteditable="true"]').filter({ visible: true }).fill("");
  await request.post(`${fixture.origin}/fixture/action`, { data: { action: "queue-available" } });
  await expect(main.getByRole("button", { name: "Refresh queue", exact: true })).toHaveCount(0);
  await expect(
    main.locator('[data-testid="content-editable"][contenteditable="true"]').filter({ visible: true }),
  ).toHaveAttribute("contenteditable", "true");
  await request.post(`${fixture.origin}/fixture/action`, { data: { action: "offline" } });
  await page.goto(sessionUrl());
  await expect(
    page
      .getByText(/Laptop is offline/)
      .filter({ visible: true })
      .first(),
  ).toBeVisible();
  await expect(main.getByText("Working on Laptop.", { exact: true }).filter({ visible: true }).first()).toBeVisible();
  await expect(
    main.getByText("Readable offline queue", { exact: true }).filter({ visible: true }).first(),
  ).toBeVisible();
  await expect(
    main.getByRole("button", { name: "Edit queued message: Readable offline queue", exact: true }),
  ).toHaveCount(0);
  await expect(main.getByRole("button", { name: "Open workspace", exact: true })).toHaveCount(0);
  await expect(
    page.locator('[data-testid="content-editable"][contenteditable="true"]').filter({ visible: true }),
  ).toHaveCount(0);
  await expect(main.getByRole("button", { name: "Stop Response", exact: true })).toHaveCount(0);
  await page.screenshot({ path: test.info().outputPath("offline-readable.png") });
  // Preserve the reconnect/presence race at the actual server-side owner boundary.
  await request.post(`${fixture.origin}/fixture/action`, { data: { action: "hold-presence" } });
  try {
    await request.post(`${fixture.origin}/fixture/action`, { data: { action: "online" } });
    await main.getByRole("button", { name: "Check connection", exact: true }).click();
  } finally {
    await request.post(`${fixture.origin}/fixture/action`, { data: { action: "release-presence" } });
  }
  await expect(
    main.locator('[data-testid="content-editable"][contenteditable="true"]').filter({ visible: true }),
  ).toHaveAttribute("contenteditable", "true");
  await expect(main.getByRole("button", { name: "Open workspace", exact: true })).toBeVisible();
  await expect(
    main.getByRole("button", { name: "Edit queued message: Readable offline queue", exact: true }),
  ).toBeVisible();
  await expect(main.getByText(/Laptop is offline/).filter({ visible: true })).toHaveCount(0);
  await page.goto(`${fixture.origin}/projects/${fixture.projectId}/sessions/compose`);
  // An empty local device value uses the native selection placeholder.
  await page.locator('[data-workbench-panel="main"]').getByRole("button", { name: "Select", exact: true }).click();
  await page.getByRole("menuitemradio", { name: "Laptop", exact: true }).click();
  const editor = main.locator('[data-testid="content-editable"][contenteditable="true"]').filter({ visible: true });
  await editor.fill("New session on Laptop");
  await page.reload();
  await expect(editor).toHaveText("New session on Laptop");
  await expect(main.getByRole("button", { name: "Laptop", exact: true })).toBeVisible();
  await main.getByTestId("send-message-button").filter({ visible: true }).click();
  await expect(main.getByText("Working on Laptop.", { exact: true }).filter({ visible: true }).first()).toBeVisible();
  await expect(main.getByRole("button", { name: "Select device", exact: true })).toHaveCount(0);
  await expect
    .poll(async () => {
      const state = await (await request.get(`${fixture.origin}/fixture/state`)).json();
      expect(state.sourceSessions).toEqual([]);
      return state.targetSessions.some((session: { title: string }) => session.title === "New session on Laptop");
    })
    .toBe(true);
});
