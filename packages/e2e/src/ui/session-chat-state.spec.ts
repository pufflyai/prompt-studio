import { Buffer } from "node:buffer";
import { expect, test } from "@playwright/test";
import { openSessionsInSidePanelTabs } from "../helpers/session-side-panel";
import { uiOrigin as apiBase } from "../ui-server";

test("keeps each session's draft when switching Side Panel tabs", async ({ page, request }) => {
  const { selectSession } = await openSessionsInSidePanelTabs(page, request, "Session drafts");
  const editor = page
    .locator('[data-workbench-region="side"] [data-workbench-instance]:visible')
    .getByTestId("content-editable")
    .last();

  // Key by key: the composer must keep focus while the host stores each keystroke.
  await editor.pressSequentially("Draft for B");
  await expect(editor).toHaveText("Draft for B");
  await selectSession("Session A");
  await expect(editor).toBeEmpty();
  await editor.fill("Draft for A");
  await selectSession("Session B");
  await expect(editor).toHaveText("Draft for B");
  await selectSession("Session A");
  await expect(editor).toHaveText("Draft for A");
});

test("keeps the unsent draft after editing a queued follow-up", async ({ page, request }) => {
  const { header, sessions } = await openSessionsInSidePanelTabs(page, request, "Queued edits");
  const session = sessions[1]!;
  const side = page.locator('[data-workbench-region="side"] [data-workbench-instance]:visible');
  const editor = side.getByTestId("content-editable").last();
  const send = side.getByTestId("send-message-button").last();
  await request.patch(`${apiBase}/v1/sessions/${session.id}/status`, { data: { status: "in_progress" } });
  await expect(
    header.getByRole("tab", { name: session.title, exact: true }).locator('[aria-label="Session status: in_progress"]'),
  ).toBeVisible();

  await editor.fill("Queued note");
  await expect(send).toHaveAttribute("aria-label", "Queue message");
  await send.click();
  const edit = side.getByRole("button", { name: "Edit queued message: Queued note", exact: true });
  await expect(edit).toBeVisible();
  await expect(editor).toHaveAttribute("contenteditable", "true");
  await editor.fill("Half-written note");
  await edit.click();
  await expect(editor).toHaveText("Queued note");
  await expect(side.getByRole("button", { name: "Edit saved draft", exact: true })).toHaveText("Half-written note");
  await editor.fill("Queued note, edited");
  await side.getByRole("button", { name: "Update", exact: true }).click();

  await expect(side.getByText("Queued note, edited", { exact: true })).toBeVisible();
  await expect(editor).toHaveText("Half-written note");
});

test("creates the draft session after focusing another panel while its request is pending", async ({
  page,
  request,
}) => {
  const { header, project } = await openSessionsInSidePanelTabs(page, request, "Background session start");
  const mainHeader = page.locator('[data-workbench-panel-header="main"]');
  await mainHeader.getByRole("button", { name: "Add panel", exact: true }).click();
  await page.getByRole("menuitem", { name: "Session", exact: true }).click();
  const draftTab = mainHeader.getByRole("tab", { name: "New session", exact: true });
  await expect(draftTab).toHaveAttribute("aria-selected", "true");
  const main = page.locator('[data-workbench-region="main"] [data-workbench-instance]:visible');
  const editor = main.getByTestId("content-editable").last();
  const showSide = page.getByRole("button", { name: "Show Side Panel", exact: true });
  if (await showSide.isVisible()) await showSide.click();
  await expect(header.getByRole("tab", { name: "Session B", exact: true })).toBeVisible();

  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/v1/sessions", async (route) => {
    if (route.request().method() === "POST") await held;
    await route.continue();
  });
  const created = page.waitForResponse(
    (response) => response.request().method() === "POST" && response.url().endsWith("/v1/sessions"),
  );
  const prompt = "Start while away";
  await editor.fill(prompt);
  await expect(main.getByTestId("send-message-button").last()).toBeEnabled();
  await main.getByTestId("send-message-button").last().click();
  await expect(editor).toBeEmpty();
  await header.getByRole("tab", { name: "Session B", exact: true }).click();
  await draftTab.click();
  await expect(editor).toHaveAttribute("contenteditable", "false");
  await expect(main.getByTestId("send-message-button").last()).toBeDisabled();
  await header.getByRole("tab", { name: "Session B", exact: true }).click();
  release();
  expect((await created).ok()).toBe(true);

  const createdTab = mainHeader.getByRole("tab", { name: prompt, exact: true });
  await expect(createdTab).toBeVisible();
  await expect(draftTab).toHaveCount(0);
  await createdTab.click();
  await expect(editor).toBeEmpty();
  const sessions = (await (await request.get(`${apiBase}/v1/sessions?project_id=${project.id}`)).json()) as {
    title: string;
  }[];
  expect(sessions.filter((session) => session.title === prompt)).toHaveLength(1);
});

test("keeps draft attachments with the session they were added to", async ({ page, request }) => {
  const { selectSession } = await openSessionsInSidePanelTabs(page, request, "Session attachments per tab");
  const side = page.locator('[data-workbench-region="side"] [data-workbench-instance]:visible');

  await side.locator("input[type='file']").setInputFiles({
    name: "notes-for-b.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("Context for session B"),
  });
  await expect(side.getByText("notes-for-b.txt")).toBeVisible();
  await selectSession("Session A");
  await expect(side.getByText("notes-for-b.txt")).toHaveCount(0);
  await selectSession("Session B");
  await expect(side.getByText("notes-for-b.txt")).toBeVisible();
  let release!: () => void;
  let uploaded!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  const uploading = new Promise<void>((resolve) => {
    uploaded = resolve;
  });
  await page.route("**/v1/projects/*/session-attachments", async (route) => {
    uploaded();
    await held;
    await route.continue();
  });
  await side.locator("input[type='file']").setInputFiles({
    name: "late-upload-for-b.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("Late context for B"),
  });
  await uploading;
  await selectSession("Session A");
  await selectSession("Session B");
  await expect(side.getByTestId("send-message-button").last()).toBeDisabled();
  release();
  await expect(side.getByText("late-upload-for-b.txt")).toBeVisible();
  await expect(side.getByText("notes-for-b.txt")).toBeVisible();
});
