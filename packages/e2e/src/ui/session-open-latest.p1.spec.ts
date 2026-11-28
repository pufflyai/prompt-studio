import { folderProjectInput } from "../helpers/folder-project";
import { fakeHarnessId, switchSession } from "../helpers/session-side-panel";
import { expect, test } from "../scripts/session-test";
import { uiOrigin as apiBase } from "../ui-server";
import { addSideNewSession, openSessionSidePanel, prepareResourceActionsDashboard } from "./helpers/resource-actions";

// Opening a session shows its latest reply. Returning to a retained conversation keeps the reader's
// position and its rendered transcript, and lands on the latest reply only when something new arrived.
test("opens a session at its latest reply and keeps the reading position when returning", async ({ page, request }) => {
  const created = await request.post(`${apiBase}/v1/projects`, {
    data: folderProjectInput({ name: "Open latest conversation", agents: [fakeHarnessId] }),
  });
  expect(created.ok()).toBe(true);
  const project = await created.json();
  const completed = (sessionId: string) =>
    expect
      .poll(async () => (await (await request.get(`${apiBase}/v1/sessions/${sessionId}`)).json()).status, {
        timeout: 20_000,
      })
      .toBe("completed");
  let longSessionId = "";
  for (const title of ["Long conversation", "Another conversation"]) {
    const prompt =
      title === "Long conversation"
        ? "Replay __fake_long_stream__"
        : `[Open long conversation](/projects/${project.id}/session?resource=${encodeURIComponent(`pstdio://extension-resource/session/${longSessionId}`)})`;
    const response = await request.post(`${apiBase}/v1/sessions`, {
      data: { project_id: project.id, title, prompt, agent: fakeHarnessId },
    });
    expect(response.ok()).toBe(true);
    const session = await response.json();
    if (title === "Long conversation") longSessionId = session.id;
    await completed(session.id);
  }
  await prepareResourceActionsDashboard(page, project.id);
  await page.goto(`/projects/${project.id}/sessions`);
  await openSessionSidePanel(page, "Long conversation");
  const side = page.locator('[data-workbench-panel="side"]');
  const tab = side.getByRole("tab", { name: "Long conversation", exact: true });
  const viewport = side.getByRole("log").locator(':scope > [data-scope="scroll-area"] > [data-part="viewport"]');
  const gap = () => viewport.evaluate((element) => element.scrollHeight - element.clientHeight - element.scrollTop);
  const scrollTop = () => viewport.evaluate((element) => element.scrollTop);
  const latestStep = side.getByText(/^Step 30\./).last();
  await expect(latestStep).toBeInViewport();
  await expect.poll(gap).toBeLessThanOrEqual(2);

  // Nothing new arrived: the same transcript comes back where the reader left it.
  await viewport.press("PageUp");
  await expect(side.getByRole("button", { name: "Scroll to latest message" })).toBeVisible();
  await expect.poll(gap).toBeGreaterThan(20);
  await viewport.evaluate((element) => element.setAttribute("data-e2e-retained", ""));
  const readingAt = await scrollTop();
  const another = await addSideNewSession(page);
  await another.click({ button: "right" });
  await switchSession(page, "Another conversation");
  await expect(tab).toHaveAttribute("aria-selected", "false");
  await tab.click();
  await expect(tab).toHaveAttribute("aria-selected", "true");
  await expect(viewport).toHaveAttribute("data-e2e-retained", "");
  await expect(side.getByRole("button", { name: "Scroll to latest message" })).toBeVisible();
  // Revealed rows can be re-measured by a few pixels; a PageUp moves several hundred.
  expect(Math.abs((await scrollTop()) - readingAt)).toBeLessThanOrEqual(40);

  // A reply arrived while away: returning lands on it.
  await side.getByRole("tab", { name: "Another conversation", exact: true }).click();
  await expect(tab).toHaveAttribute("aria-selected", "false");
  const followUp = await request.post(`${apiBase}/v1/sessions/${longSessionId}/follow-up`, {
    data: { prompt: "Replay __fake_long_stream__" },
  });
  expect(followUp.ok()).toBe(true);
  await expect
    .poll(async () => (await (await request.get(`${apiBase}/v1/sessions/${longSessionId}`)).json()).status)
    .not.toBe("completed");
  await completed(longSessionId);
  await tab.click();
  await expect(viewport).toHaveAttribute("data-e2e-retained", "");
  await expect.poll(gap).toBeLessThanOrEqual(2);
  await expect(latestStep).toBeInViewport();

  // Reopening a closed session starts at its latest reply.
  await viewport.press("PageUp");
  await expect.poll(gap).toBeGreaterThan(20);
  await side.getByRole("button", { name: "Close Long conversation", exact: true }).click();
  await expect(tab).toHaveCount(0);
  await side.getByRole("tab", { name: "Another conversation", exact: true }).click({ button: "right" });
  await switchSession(page, "Long conversation");
  await expect(latestStep).toBeInViewport();
  await expect.poll(gap).toBeLessThanOrEqual(2);

  // Hiding the panel and following a link back with nothing new keeps the reading position.
  await viewport.press("PageUp");
  await expect.poll(gap).toBeGreaterThan(20);
  await page.getByRole("button", { name: "Hide Side Panel", exact: true }).click();
  await expect(viewport).toBeHidden();
  await page.getByRole("option", { name: "Another conversation", exact: true }).click();
  const link = page
    .locator('[data-workbench-panel="main"]')
    .getByRole("link", { name: /long conversation/i })
    .last();
  await expect(link).toBeVisible();
  await link.click();
  await expect(viewport).toBeVisible();
  // Re-showing the panel re-measures its rows, so the offset can shift; the reader must not be moved to the latest reply.
  await expect(side.getByRole("button", { name: "Scroll to latest message" })).toBeVisible();
  expect(await gap()).toBeGreaterThan(20);
});
