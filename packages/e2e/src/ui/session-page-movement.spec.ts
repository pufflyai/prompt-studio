import { Buffer } from "node:buffer";
import { type APIRequestContext, expect, type Page, test } from "@playwright/test";
import { folderProjectInput } from "../helpers/folder-project";
import { fakeHarnessId } from "../helpers/session-side-panel";
import { uiOrigin as apiBase } from "../ui-server";

const openSessionPage = async (page: Page, request: APIRequestContext, prompt: string) => {
  const project = await (
    await request.post(`${apiBase}/v1/projects`, {
      data: folderProjectInput({ name: "Move a live session", agents: [fakeHarnessId] }),
    })
  ).json();
  const response = await request.post(`${apiBase}/v1/sessions`, {
    data: { project_id: project.id, title: "Live session", prompt, agent: fakeHarnessId },
  });
  expect(response.ok()).toBe(true);
  const session = await response.json();
  await page.addInitScript((id) => {
    localStorage.setItem("onboarding-complete", "true");
    localStorage.setItem("dashboard-wb2:selected-project:global", id);
  }, project.id);
  await page.goto(`/projects/${project.id}/sessions`);
  await page.getByRole("option", { name: session.title, exact: true }).click();
  return { project, session };
};

test("moving a live session tab retains its composer, transcript, attachment, and stream", async ({
  page,
  request,
}) => {
  const subscriptions: string[] = [];
  page.on("request", (sent) => {
    if (new URL(sent.url()).pathname.endsWith("/subscriptions") && sent.method() === "POST")
      subscriptions.push(sent.postDataJSON().session_id);
  });
  const { session } = await openSessionPage(page, request, "Keep working __fake_hold__");
  const url = page.url();
  const sessionUrl = `${apiBase}/v1/sessions/${session.id}`;
  try {
    const tab = page.getByRole("tab", { name: session.title, exact: true });
    const instance = await tab.locator("..").getAttribute("data-workbench-tab");
    const live = page.locator(`[data-workbench-instance="${instance}"]`);
    const editor = live.locator('[data-testid="content-editable"][contenteditable="true"]');
    await expect(page.getByRole("log")).toContainText('Fake Agent: completed "Keep working fake_hold"');
    await editor.fill("Continue with this context");
    await editor.evaluate((element) => {
      (window as Window & { liveSessionEditor?: Element }).liveSessionEditor = element;
    });
    await live.locator('input[type="file"]').setInputFiles({
      name: "context.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("Keep this attachment while moving"),
    });
    await expect(page.getByText("context.txt", { exact: true }).filter({ visible: true })).toBeVisible();
    await page.getByRole("button", { name: "Open Side Panel", exact: true }).click();
    await page.getByRole("button", { name: "Reattach Side Panel", exact: true }).click();
    const start = (await tab.boundingBox())!;
    const target = (await page.getByTestId("workbench-side-panel-attached").boundingBox())!;
    // Start and cancel a native drag before committing the move.
    await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
    await page.mouse.down();
    await page.mouse.move(start.x + start.width / 2 + 20, start.y + start.height / 2, { steps: 3 });
    await page.keyboard.press("Escape");
    await page.mouse.up();
    await expect(
      page.locator('[data-workbench-panel-header="main"]').getByRole("tab", { name: session.title }),
    ).toBeVisible();
    await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
    await page.mouse.down();
    await page.mouse.move(start.x + start.width / 2 + 15, start.y + start.height / 2, { steps: 3 });
    await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 12 });
    await expect(page.locator('[data-workbench-tab-drop="side"][data-drop-active]')).toBeVisible();
    await page.mouse.up();
    for (const region of ["side", "secondary", "main"]) {
      const header = page.locator(`[data-workbench-panel-header="${region}"]`);
      const moved = header.getByRole("tab", { name: session.title, exact: true });
      await expect(moved).toBeVisible();
      expect(await moved.locator("..").getAttribute("data-workbench-tab")).toBe(instance);
      await expect(page).toHaveURL(url);
      const active = page.locator(`[data-workbench-panel="${region}"]`);
      if (region === "secondary") {
        // The default Bottom height is occupied by the draft, attachment, and toolbar.
        // Give the conversation viewport room before checking its virtual rows.
        const separator = page.getByRole("separator", { name: "Resize Secondary Panel", exact: true });
        console.log(
          "Bottom conversation height before resizing:",
          await live.getByRole("log").evaluate((element) => element.clientHeight),
        );
        await separator.focus();
        await separator.press("End");
        await expect.poll(() => live.getByRole("log").evaluate((element) => element.clientHeight)).toBeGreaterThan(0);
      }
      await expect(active.getByRole("log")).toContainText('Fake Agent: completed "Keep working fake_hold"');
      await expect(active.getByText("context.txt", { exact: true }).filter({ visible: true })).toBeVisible();
      await expect(editor).toHaveText("Continue with this context");
      expect(
        await editor.evaluate(
          (element) => element === (window as Window & { liveSessionEditor?: Element }).liveSessionEditor,
        ),
      ).toBe(true);
      if (region !== "main") {
        await moved.focus();
        await moved.press("Shift+F10");
        await page
          .getByRole("menuitem", { name: region === "side" ? "Move to Secondary" : "Move to Main", exact: true })
          .click();
      }
    }
    expect(subscriptions).toEqual([session.id]);
    const queued = page.waitForRequest((sent) => sent.url() === `${sessionUrl}/follow-up` && sent.method() === "POST");
    await live.getByTestId("send-message-button").click();
    expect((await queued).postDataJSON()).toMatchObject({
      prompt: "Continue with this context",
      attachments: [expect.anything()],
    });
    await expect(
      page.getByRole("button", { name: "Edit queued message: Continue with this context", exact: true }),
    ).toBeVisible();
    const stopped = page.waitForRequest((sent) => sent.url() === `${sessionUrl}/status` && sent.method() === "PATCH");
    await live.getByRole("button", { name: "Stop Response", exact: true }).click();
    expect((await stopped).postDataJSON()).toMatchObject({ status: "cancelled" });
  } finally {
    await request.patch(`${sessionUrl}/status`, { data: { status: "cancelled" } });
  }
});

test("answering a question after moving the session updates its live conversation", async ({ page, request }) => {
  const { session } = await openSessionPage(page, request, "Choose a language __fake_question_prompt__");
  const tab = page.getByRole("tab", { name: session.title, exact: true });
  await expect(page.getByRole("radio", { name: "TypeScript", exact: true })).toBeVisible();
  await tab.focus();
  await tab.press("Shift+F10");
  await page.getByRole("menuitem", { name: "Move to Side", exact: true }).click();
  const side = page.locator('[data-workbench-panel="side"]');
  await expect(side.getByRole("tab", { name: session.title, exact: true })).toBeVisible();
  await side.getByRole("form", { name: "Question form" }).getByText("TypeScript", { exact: true }).click();
  const answered = page.waitForRequest(
    (sent) => sent.url().endsWith(`/sessions/${session.id}/follow-up`) && sent.method() === "POST",
  );
  await side.getByTestId("send-message-button").click();
  expect((await answered).postDataJSON()).toMatchObject({ question_response: { answers: [["TypeScript"]] } });
  await expect(side.getByRole("log")).toContainText(
    'Fake Agent: follow-up "Which language do you want to use?: TypeScript"',
  );
});
