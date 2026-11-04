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
  await page.addInitScript((projectId: string) => {
    localStorage.setItem("onboarding-complete", "true");
    localStorage.setItem("dashboard-wb2:selected-project:global", projectId);
  }, fixture.projectId);
  await page.goto(sessionUrl());
  const editor = page.getByTestId("content-editable").filter({ visible: true }).last();
  const send = page.getByTestId("send-message-button").filter({ visible: true }).last();
  await expect(page.getByTestId("session-device").filter({ visible: true }).last()).toContainText("Laptop");
  await expect(page.getByRole("button", { name: "Select device", exact: true })).toHaveCount(0);
  await expect(editor).toHaveAttribute("contenteditable", "true");
  await expect(page.getByText("Working on Laptop.", { exact: true }).filter({ visible: true })).toBeVisible();
  await editor.fill("Queued from the browser");
  await send.click();
  const queued = page.getByRole("button", { name: "Edit queued message: Queued from the browser", exact: true });
  await expect(queued).toBeVisible();
  await queued.click();
  await editor.fill("Edited from the browser");
  await page.getByRole("button", { name: "Update", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Edit queued message: Edited from the browser", exact: true }),
  ).toBeVisible();
  const state = async () => (await request.get(`${fixture.origin}/fixture/state`)).json();
  await expect.poll(async () => (await state()).queue[0]?.prompt).toBe("Edited from the browser");
  await page.getByRole("button", { name: "Remove queued follow-up", exact: true }).click();
  await expect.poll(async () => (await state()).queue).toEqual([]);
  const queueRoute = `**/v1/sessions/${fixture.sessionId}/queued-messages`;
  await page.route(queueRoute, async (route) => {
    const response = await route.fetch();
    const saved = await response.json();
    await route.fulfill({ response, json: { ...saved, queue: { ...saved.queue, readOnly: true } } });
  });
  await page.goto(sessionUrl());
  await expect(page.getByRole("button", { name: "Refresh queue", exact: true })).toBeVisible();
  await request.post(`${fixture.origin}/fixture/action`, { data: { action: "question" } });
  await expect(page.getByRole("radio", { name: "Blue", exact: true })).toBeVisible();
  await page.getByRole("form", { name: "Question form" }).getByText("Blue", { exact: true }).click();
  await expect(page.getByRole("radio", { name: "Blue", exact: true })).toBeChecked();
  await send.click();
  await expect.poll(async () => (await state()).answers).toEqual([{ callId: "remote-question", answers: [["Blue"]] }]);
  await request.post(`${fixture.origin}/fixture/action`, { data: { action: "approval" } });
  await page.getByRole("button", { name: "Approve", exact: true }).click();
  await expect.poll(async () => (await state()).approvals).toEqual([{ id: "remote-approval", decision: "approve" }]);
  await page.getByRole("button", { name: "Stop Response", exact: true }).click();
  await expect.poll(async () => (await state()).stops).toEqual([fixture.sessionId]);
  const after = await state();
  expect(after.sourceSessions).toEqual([]);
  expect(after.targetSessions.find((session: { id: string }) => session.id === fixture.unrelatedId).status).toBe(
    "in_progress",
  );
  await page.unroute(queueRoute);
  await page.goto(sessionUrl());
  await expect(page.getByRole("button", { name: "Refresh queue", exact: true })).toHaveCount(0);
  await expect(editor).toHaveAttribute("contenteditable", "true");
  await editor.fill("Resume on Laptop");
  await send.click();
  await expect
    .poll(
      async () =>
        (await state()).targetSessions.find((session: { id: string }) => session.id === fixture.sessionId).status,
    )
    .toBe("in_progress");
  await expect(page.getByRole("button", { name: "Stop Response", exact: true })).toBeVisible();
  await page.screenshot({ path: test.info().outputPath("online-owner.png") });
});

test("remote workspace files and diff open on their owner; offline history stays readable and new drafts choose a device", async ({
  page,
  request,
}) => {
  await page.addInitScript((projectId: string) => {
    localStorage.setItem("onboarding-complete", "true");
    localStorage.setItem("dashboard-wb2:selected-project:global", projectId);
    localStorage.setItem(
      `pstdio-dashboard:command-params:recent-harness:${projectId}`,
      JSON.stringify({ harnessId: "pstdio.pstdio-browser-remote.harness.browser-remote" }),
    );
  }, fixture.projectId);
  await page.goto(sessionUrl());
  const filesRead = page.waitForResponse(
    (response) => response.url().includes(`/v1/workspaces/${fixture.workspaceId}/files`) && response.ok(),
  );
  await page.getByRole("button", { name: "Open workspace", exact: true }).click();
  await filesRead;
  const file = page.getByRole("option").filter({ hasText: "target-note.md" }).first();
  await file.getByText("target-note.md", { exact: true }).click();
  await expect(
    page.getByText("Target-owned changed content.", { exact: false }).filter({ visible: true }).first(),
  ).toBeVisible();
  const queuedResponse = await request.post(`${fixture.origin}/v1/sessions/${fixture.sessionId}/follow-up`, {
    data: { prompt: "Readable offline queue" },
  });
  expect(queuedResponse.ok()).toBe(true);
  await page.getByRole("tab", { name: "Changes", exact: true }).click();
  await expect(page.getByTestId("diff-viewer")).toBeVisible();
  await expect(
    page.getByText("Target-owned changed content.", { exact: false }).filter({ visible: true }).first(),
  ).toBeVisible();
  // An incomplete saved queue must not hide essential controls for an online owner.
  const queueRoute = `**/v1/sessions/${fixture.sessionId}/queued-messages`;
  await page.route(queueRoute, async (route) => {
    const response = await route.fetch();
    const saved = await response.json();
    await route.fulfill({ response, json: { ...saved, queue: { ...saved.queue, readOnly: true } } });
  });
  await page.goto(sessionUrl());
  await expect(page.getByRole("button", { name: "Refresh queue", exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Edit queued message: Readable offline queue", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByText("Laptop is offline", { exact: true }).filter({ visible: true })).toHaveCount(0);
  await expect(page.getByTestId("content-editable").filter({ visible: true }).last()).toHaveAttribute(
    "contenteditable",
    "true",
  );
  await page.getByTestId("content-editable").filter({ visible: true }).last().fill("Keep this draft while refreshing");
  await expect(page.getByRole("button", { name: "Stop Response", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Open workspace", exact: true })).toBeVisible();
  await page.getByTestId("content-editable").filter({ visible: true }).last().fill("");
  await page.unroute(queueRoute);
  await page.getByRole("button", { name: "Refresh queue", exact: true }).click();
  await expect(page.getByTestId("content-editable").filter({ visible: true }).last()).toHaveAttribute(
    "contenteditable",
    "true",
  );
  await request.post(`${fixture.origin}/fixture/action`, { data: { action: "offline" } });
  await page.goto(sessionUrl());
  await expect(page.getByText("Laptop is offline", { exact: true }).filter({ visible: true }).first()).toBeVisible();
  await expect(page.getByText("Working on Laptop.", { exact: true }).filter({ visible: true }).first()).toBeVisible();
  await expect(
    page.getByText("Readable offline queue", { exact: true }).filter({ visible: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Edit queued message: Readable offline queue", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Open workspace", exact: true })).toHaveCount(0);
  await expect(
    page.locator('[data-testid="content-editable"][contenteditable="true"]').filter({ visible: true }),
  ).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Stop Response", exact: true })).toHaveCount(0);
  await page.screenshot({ path: test.info().outputPath("offline-readable.png") });
  await request.post(`${fixture.origin}/fixture/action`, { data: { action: "online" } });
  await page.getByRole("button", { name: "Check connection", exact: true }).click();
  await expect(page.getByTestId("content-editable").filter({ visible: true }).last()).toHaveAttribute(
    "contenteditable",
    "true",
  );
  await expect(page.getByRole("button", { name: "Open workspace", exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Edit queued message: Readable offline queue", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Laptop is offline", { exact: true }).filter({ visible: true })).toHaveCount(0);
  await page.goto(`${fixture.origin}/projects/${fixture.projectId}/sessions/compose`);
  await page.getByRole("button", { name: "Select device", exact: true }).click();
  await page.getByRole("menuitem", { name: "Laptop", exact: true }).click();
  const editor = page.getByTestId("content-editable").filter({ visible: true }).last();
  await editor.fill("New session on Laptop");
  await page.getByTestId("send-message-button").filter({ visible: true }).last().click();
  await expect(page.getByTestId("session-device").filter({ visible: true }).last()).toContainText("Laptop");
  await expect(page.getByRole("button", { name: "Select device", exact: true })).toHaveCount(0);
  await expect
    .poll(async () => {
      const state = await (await request.get(`${fixture.origin}/fixture/state`)).json();
      expect(state.sourceSessions).toEqual([]);
      return state.targetSessions.some((session: { title: string }) => session.title === "New session on Laptop");
    })
    .toBe(true);
});
