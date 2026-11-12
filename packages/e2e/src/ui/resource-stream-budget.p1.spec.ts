import { readFile } from "node:fs/promises";
import { observeEventConnectionBudget } from "../helpers/event-connection-budget";
import { getPlannerTicket } from "../helpers/planner-api";
import { createResourceStreamFixture } from "../helpers/resource-stream-fixture";
import { expect, test } from "../scripts/session-test";
import { prepareDashboard } from "./helpers/workspace-files";

let fixture: Awaited<ReturnType<typeof createResourceStreamFixture>>;
// Provision the given resources once; each case still opens its own browser connections from scratch.
test.beforeAll(async ({ request, baseURL }) => {
  fixture = await createResourceStreamFixture(request, baseURL!);
});
test.afterAll(async ({ request }) => {
  await fixture?.cleanup(request);
});

// Critical: live SDK resource accumulation must leave ordinary HTTP/1.1 requests usable.
test("mixed resources share two HTTP/1.1 connections through admission cancellation, close and reconnect", async ({
  page,
  request,
  baseURL,
}, testInfo) => {
  const { projectId, projects, tickets, targets, destination, session, script } = fixture;
  await page.route("**/__resource-client.js", (route) =>
    route.fulfill({ contentType: "text/javascript", body: script }),
  );
  // A minimal same-origin page exercises the shipped SDK against real host services.
  await page.route("**/__resource-budget", (route) =>
    route.fulfill({ contentType: "text/html", body: "<!doctype html><title>Resource stream budget</title>" }),
  );
  const budget = await observeEventConnectionBudget(page);
  await page.goto("/__resource-budget");
  await page.evaluate(async () => {
    const path = "/__resource-client.js";
    Reflect.set(window, "resourceClient", await import(path));
  });
  const content = await page.evaluate((input) => Reflect.get(window, "resourceClient").start(input), {
    projectId,
    targets,
    sessionId: session.id,
  });
  expect(content).toHaveLength(8);
  expect(content[7]).toContain("Retained file 2");
  await page.evaluate((id) => Reflect.get(window, "resourceClient").publishActivity(id), projectId);
  await expect
    .poll(() => page.evaluate(() => Reflect.get(window, "resourceClient").state().activityEvents))
    .toBeGreaterThan(0);
  await expect
    .poll(() => page.evaluate(() => Reflect.get(window, "resourceClient").state()))
    .toMatchObject({ activityReadies: 1, sync: true, chunks: 1, connected: true, sessionEvents: expect.any(Number) });
  expect(await page.evaluate(() => Reflect.get(window, "resourceClient").state().sessionEvents)).toBeGreaterThan(0);
  // Hold admission, cancel its logical owner, then allow the acknowledgement to arrive late.
  const admission = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  let pendingId = "";
  const removed: string[] = [];
  page.on("request", (sent) => {
    if (sent.method() === "DELETE") removed.push(new URL(sent.url()).pathname.split("/").at(-1)!);
  });
  await page.route("**/session-stream/*/subscriptions", async (route) => {
    const input = route.request().postDataJSON();
    if (!pendingId && input.native_document) {
      pendingId = input.subscription_id;
      admission.resolve();
      await release.promise;
    }
    await route.continue();
  });
  await page.evaluate(() => Reflect.get(window, "resourceClient").pendingWatch());
  await admission.promise;
  await page.evaluate(() => Reflect.get(window, "resourceClient").cancelPending());
  release.resolve();
  await expect.poll(() => removed).toContain(pendingId);
  await page.unroute("**/session-stream/*/subscriptions");
  await page.evaluate(() => Reflect.get(window, "resourceClient").editAndClose());
  await expect
    .poll(async () => (await getPlannerTicket(request, baseURL!, projectId, tickets[0]!.id))?.content)
    .toContain("Saved through pending close.");
  const opened = await page.evaluate(
    ({ id, ticketId }) =>
      Reflect.get(window, "resourceClient").open(id, {
        fileRendererId: "pstdio.pstdio-planner.view.ticket-editor",
        resource: { type: "ticket", id: ticketId },
      }),
    { id: projects[1]!.id, ticketId: destination.id },
  );
  expect(opened).toContain("Destination content");
  expect(
    await page.evaluate(async (id) => (await fetch(`/v1/projects/${id}/extensions/ui`)).status, projects[1]!.id),
  ).toBe(200);
  const beforeSwitchEvent = await page.evaluate(() => Reflect.get(window, "resourceClient").state().snapshots);
  await page.evaluate(() => Reflect.get(window, "resourceClient").editPeer());
  await expect
    .poll(() => page.evaluate(() => Reflect.get(window, "resourceClient").state().snapshots))
    .toBeGreaterThan(beforeSwitchEvent);
  expect(await page.evaluate((id) => Reflect.get(window, "resourceClient").progress(id), projectId)).toHaveLength(3);
  const beforeRecovery = await page.evaluate(() => Reflect.get(window, "resourceClient").state().snapshots);
  await page.evaluate(() => Reflect.get(window, "resourceClient").drop());
  await expect
    .poll(() => page.evaluate(() => Reflect.get(window, "resourceClient").state()))
    .toMatchObject({ connected: true, resets: 8, activityReadies: 2 });
  await expect
    .poll(() => page.evaluate(() => Reflect.get(window, "resourceClient").state().snapshots))
    .toBeGreaterThan(beforeRecovery);
  const afterRecovery = await page.evaluate(() => Reflect.get(window, "resourceClient").state().snapshots);
  await page.evaluate(() => Reflect.get(window, "resourceClient").editPeer());
  await expect
    .poll(() => page.evaluate(() => Reflect.get(window, "resourceClient").state().snapshots))
    .toBeGreaterThan(afterRecovery);
  expect(await page.evaluate((id) => Reflect.get(window, "resourceClient").progress(id), projectId)).toHaveLength(3);
  await page.evaluate(() => Reflect.get(window, "resourceClient").close());
  await expect.poll(() => budget.state().active).toHaveLength(0);
  budget.assert();
  await testInfo.attach("connection-budget", {
    body: JSON.stringify(budget.state(), null, 2),
    contentType: "application/json",
  });
});

// Critical: retained dashboard editors, commands and a live session cannot starve project switching.
test("retained tickets and files keep tools responsive while switching projects with live commands and a session", async ({
  page,
  request,
}, testInfo) => {
  const { projectId, projects, tickets, destination } = fixture;
  const budget = await observeEventConnectionBudget(page);
  await prepareDashboard(page, projectId);
  await page.goto(`/projects/${projectId}/extensions/test.stream-fixture/live`);
  await page
    .frameLocator('iframe[title="Stream fixture"]')
    .getByRole("button", { name: "Start streams", exact: true })
    .click();
  await expect(page.frameLocator('iframe[title="Stream fixture"]').locator("output")).toHaveText("Live 10");
  await page.getByRole("option", { name: "Tickets", exact: true }).click();
  for (const ticket of tickets) {
    await page.getByTestId("renderer-card").filter({ hasText: ticket.title }).first().click();
    await expect(page.locator('[contenteditable="true"]:visible').first()).toContainText("Body");
    await page.goBack();
  }
  await page.getByTestId("renderer-card").filter({ hasText: tickets[0]!.title }).first().click();
  for (let index = 0; index < 3; index++) {
    await page.getByRole("option", { name: `file-${index}.md`, exact: true }).click();
    await expect(page.locator('[contenteditable="true"]:visible').first()).toContainText(`Retained file ${index}`);
  }
  await page.getByRole("button", { name: "Back to project", exact: true }).click();
  await page.getByRole("option", { name: "Sessions", exact: true }).click();
  await page.getByRole("option", { name: "Budget session", exact: true }).click();
  await expect(page.getByRole("log")).toContainText("Budget session");
  const commands = await request.post(
    `/v1/projects/${projectId}/extensions/commands/test.stream-fixture.command.state/execute`,
    { data: {} },
  );
  expect((await commands.json()).outcome.value.active).toBe(10);
  await page.getByRole("button", { name: "Switch project", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Projects", exact: true })
    .getByText("Stream destination", { exact: true })
    .click();
  await expect(page).toHaveURL(new RegExp(`/projects/${projects[1]!.id}`));
  await page.getByRole("option", { name: "Tickets", exact: true }).click();
  await expect(page.getByTestId("renderer-card").filter({ hasText: destination.title }).first()).toBeVisible();
  await page.getByRole("button", { name: "Switch project", exact: true }).click();
  await page.getByRole("dialog", { name: "Projects", exact: true }).getByText("Stream source", { exact: true }).click();
  await page.getByRole("button", { name: "Back to project", exact: true }).click();
  await page.getByRole("option", { name: "Tickets", exact: true }).click();
  await page.getByTestId("renderer-card").filter({ hasText: tickets[0]!.title }).first().click();
  await expect(page.locator('[contenteditable="true"]:visible').first()).toContainText("Body 0");
  budget.assert();
  await testInfo.attach("dashboard-connection-budget", {
    body: JSON.stringify(budget.state(), null, 2),
    contentType: "application/json",
  });
});

// Critical: a selected file must be sendable without text and remain downloadable after reload.
test("resource discussion sends file-only comments and retains the original attachment", async ({ page }, testInfo) => {
  const uri = `pstdio://extension-resource/item/attachment?extensionId=test.stream-fixture&projectId=${fixture.projectId}`;
  await prepareDashboard(page, fixture.projectId);
  await page.goto(
    `/projects/${fixture.projectId}/extensions/test.stream-fixture/discussion?resource=${encodeURIComponent(uri)}`,
  );
  const activity = page.locator('[aria-label="Resource activity"]');
  const file = { name: "trace.txt", mimeType: "text/plain", buffer: Buffer.from("Original Activity evidence\n") };
  const upload = activity.locator('input[type="file"]');
  const send = activity.getByRole("button", { name: "Submit comment", exact: true });
  await expect(send).toBeDisabled();
  await upload.setInputFiles(file);
  await expect(activity.getByRole("button", { name: "Remove trace.txt" })).toBeVisible();
  await expect(send).toBeEnabled();
  await activity.getByRole("button", { name: "Remove trace.txt" }).click();
  await expect(send).toBeDisabled();
  await upload.setInputFiles(file);
  await expect(send).toBeEnabled();
  await send.click();
  await expect(activity.getByRole("button", { name: "trace.txt", exact: true })).toBeVisible();
  await page.reload();
  const downloadEvent = page.waitForEvent("download");
  await activity.getByRole("button", { name: "trace.txt", exact: true }).click();
  const download = await downloadEvent;
  const saved = testInfo.outputPath("trace.txt");
  await download.saveAs(saved);
  expect(await readFile(saved)).toEqual(file.buffer);
});
