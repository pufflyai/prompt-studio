import { folderProjectInput } from "../helpers/folder-project";
import { fakeHarnessId, switchSession } from "../helpers/session-side-panel";
import { expect, test } from "../scripts/session-test";
import { uiOrigin as apiBase } from "../ui-server";
import { addSideNewSession, openSessionSidePanel, prepareResourceActionsDashboard } from "./helpers/resource-actions";

// Selecting a retained conversation must reveal its latest reply, including its final line.
test("opens and reselects a session at the bottom of its conversation", async ({ page, request }) => {
  const created = await request.post(`${apiBase}/v1/projects`, {
    data: folderProjectInput({ name: "Open latest conversation", agents: [fakeHarnessId] }),
  });
  expect(created.ok()).toBe(true);
  const project = await created.json();
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
    await expect
      .poll(async () => (await (await request.get(`${apiBase}/v1/sessions/${session.id}`)).json()).status, {
        timeout: 20_000,
      })
      .toBe("completed");
  }
  await prepareResourceActionsDashboard(page, project.id);
  await page.goto(`/projects/${project.id}/sessions`);
  await openSessionSidePanel(page, "Long conversation");
  const side = page.locator('[data-workbench-panel="side"]');
  const tab = side.getByRole("tab", { name: "Long conversation", exact: true });
  const viewport = side.getByRole("log").locator(':scope > [data-scope="scroll-area"] > [data-part="viewport"]');
  const gap = () => viewport.evaluate((element) => element.scrollHeight - element.clientHeight - element.scrollTop);
  await expect(side.getByText(/^Step 30\./)).toBeInViewport();
  await expect.poll(gap).toBeLessThanOrEqual(2);

  await viewport.press("PageUp");
  await expect(side.getByRole("button", { name: "Scroll to latest message" })).toBeVisible();
  await expect.poll(gap).toBeGreaterThan(20);
  const another = await addSideNewSession(page);
  await another.click({ button: "right" });
  await switchSession(page, "Another conversation");
  await expect(tab).toHaveAttribute("aria-selected", "false");
  await tab.click();
  await expect(tab).toHaveAttribute("aria-selected", "true");
  await expect.poll(gap).toBeLessThanOrEqual(2);
  await expect(side.getByText(/^Step 30\./)).toBeInViewport();

  await viewport.press("PageUp");
  await expect.poll(gap).toBeGreaterThan(20);
  await tab.click({ button: "right" });
  await switchSession(page, "Long conversation");
  await expect.poll(gap).toBeLessThanOrEqual(2);

  await viewport.press("PageUp");
  await expect.poll(gap).toBeGreaterThan(20);
  await side.getByRole("button", { name: "Close Long conversation", exact: true }).click();
  await expect(tab).toHaveCount(0);
  await side.getByRole("tab", { name: "Another conversation", exact: true }).click({ button: "right" });
  await switchSession(page, "Long conversation");
  await expect(side.getByText(/^Step 30\./)).toBeInViewport();
  await expect.poll(gap).toBeLessThanOrEqual(2);

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
  await expect(side.getByText(/^Step 30\./)).toBeInViewport();
  await expect.poll(gap).toBeLessThanOrEqual(2);
});
