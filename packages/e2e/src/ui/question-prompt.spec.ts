import { expect, test } from "@playwright/test";
import { folderProjectInput } from "../helpers/folder-project";
import { uiOrigin as apiBase } from "../ui-server";

const questionPrompt = "Question follow-up test __fake_question_prompt__";

test("answers a hydrated question tool call from the session composer", async ({ page, request }) => {
  const project = process.env.E2E_COMMAND_PROJECT_ID
    ? { id: process.env.E2E_COMMAND_PROJECT_ID }
    : ((await (
        await request.post(`${apiBase}/v1/projects`, {
          data: folderProjectInput({ name: "Question Prompt" }),
        })
      ).json()) as { id: string });

  const sessionResponse = await request.post(`${apiBase}/v1/sessions`, {
    data: {
      project_id: project.id,
      title: questionPrompt,
      prompt: questionPrompt,
      agent: "pstdio.workbench-fixture.harness.fake",
    },
  });
  expect(sessionResponse.ok()).toBe(true);
  const session = (await sessionResponse.json()) as { id: string };

  await expect
    .poll(async () => {
      const conversationResponse = await request.get(`${apiBase}/v1/sessions/${session.id}/conversation`);
      expect(conversationResponse.ok()).toBe(true);
      const conversation = (await conversationResponse.json()) as {
        messages: Array<{ parts: Array<{ type: string; tool?: string }> }>;
      };
      return conversation.messages.some((message) =>
        message.parts.some((part) => part.type === "tool" && part.tool === "question"),
      );
    })
    .toBe(true);

  await page.addInitScript((projectId: string) => {
    localStorage.setItem("onboarding-complete", "true");
    localStorage.setItem("selected-agent", "pstdio.workbench-fixture.harness.fake");
    localStorage.setItem("dashboard-wb2:selected-project:global", projectId);
  }, project.id);

  await page.goto(
    `/projects/${project.id}/session?resource=${encodeURIComponent(`pstdio://extension-resource/session/${session.id}`)}`,
  );
  await expect(page.getByRole("radio", { name: "TypeScript" })).toBeVisible();

  await page.reload();

  const answerOption = page.getByRole("radio", { name: "TypeScript" });
  const sendButton = page.getByTestId("send-message-button");
  await expect(answerOption).toBeEnabled();
  await expect(sendButton).toBeDisabled();
  await page.getByText("TypeScript", { exact: true }).click();
  await expect(sendButton).toBeEnabled();

  const followUpRequestPromise = page.waitForRequest(
    (followUpRequest) =>
      followUpRequest.method() === "POST" && followUpRequest.url().endsWith(`/v1/sessions/${session.id}/follow-up`),
  );
  await sendButton.click();

  const followUpRequest = await followUpRequestPromise;
  expect(followUpRequest.postDataJSON()).toMatchObject({
    prompt: "Which language do you want to use?: TypeScript",
    question_response: { answers: [["TypeScript"]] },
  });
  await expect(page.getByText('Fake Agent: follow-up "Which language do you want to use?: TypeScript"')).toBeVisible();
});

test("async question replies preserve the draft and files until every request is handled", async ({
  page,
  request,
}) => {
  const project = process.env.E2E_COMMAND_PROJECT_ID
    ? { id: process.env.E2E_COMMAND_PROJECT_ID }
    : await (
        await request.post(`${apiBase}/v1/projects`, { data: folderProjectInput({ name: "Async questions" }) })
      ).json();
  const created = await request.post(`${apiBase}/v1/sessions`, {
    data: {
      project_id: project.id,
      title: "Async questions",
      prompt: "Hello",
      model: "fake",
      agent: "pstdio.workbench-fixture.harness.native-modes",
    },
  });
  expect(created.ok()).toBe(true);
  const session = await created.json();
  const url = `${apiBase}/v1/sessions/${session.id}`;
  await expect.poll(async () => (await (await request.get(url)).json()).status).toBe("completed");
  await page.addInitScript(() => localStorage.setItem("onboarding-complete", "true"));
  await page.goto(
    `/projects/${project.id}/session?resource=${encodeURIComponent(`pstdio://extension-resource/session/${session.id}`)}`,
  );
  const editor = page.locator('[data-testid="content-editable"][contenteditable="true"]:visible').last();
  await editor.fill("Keep my draft /go");
  await page.getByRole("listbox", { name: "Harness commands" }).getByRole("option", { name: "/goal" }).click();
  await expect(page.getByRole("button", { name: "Remove Goal", exact: true })).toBeVisible();
  await page
    .locator('input[type="file"]')
    .last()
    .setInputFiles({ name: "draft.txt", mimeType: "text/plain", buffer: Buffer.from("Saved context") });
  await expect(page.getByText("draft.txt", { exact: true })).toBeVisible();
  await editor.focus();
  await editor.press("Home");
  await editor.press("ArrowRight");
  await editor.press("ArrowRight");
  for (let index = 0; index < 4; index++) await editor.press("Shift+ArrowRight");
  await expect.poll(() => editor.evaluate(() => window.getSelection()?.toString())).toBe("ep m");
  await page.getByTestId("send-message-button").focus();
  const asked = await request.post(`${url}/follow-up`, { data: { prompt: "__fake_async_questions__" } });
  expect(asked.ok()).toBe(true);
  const first = page.getByRole("radio", { name: "TypeScript", exact: true });
  await expect(first).toBeVisible();
  await expect(editor).toBeHidden();
  await expect(page.getByTestId("send-message-button")).toBeDisabled();
  await page.getByText("TypeScript", { exact: true }).click();
  await expect
    .poll(async () => {
      const history = await (await request.get(`${url}/conversation`)).json();
      return history.messages.some((message: { parts: { callId?: string }[] }) =>
        message.parts.some((part) => part.callId === "second-question"),
      );
    })
    .toBe(true);
  await expect(first).toBeChecked();
  const failReply = async (route: import("@playwright/test").Route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "Provider unavailable" }),
    });
  await page.route(`**/sessions/${session.id}/follow-up`, failReply);
  await page.getByTestId("send-message-button").click();
  await expect(page.getByText("Message not sent", { exact: true })).toBeVisible();
  await expect(first).toBeChecked();
  await expect(page.getByTestId("send-message-button")).toBeEnabled();
  await page.getByRole("button", { name: "Dismiss", exact: true }).click();
  await page.unroute(`**/sessions/${session.id}/follow-up`, failReply);
  const reply = page.waitForRequest(
    (r) => r.method() === "POST" && r.url().endsWith(`/sessions/${session.id}/follow-up`),
  );
  await page.getByTestId("send-message-button").click();
  expect((await reply).postDataJSON()).toMatchObject({
    question_response: { callId: "first-question", answers: [["TypeScript"]] },
  });
  expect((await reply).postDataJSON().attachments ?? []).toEqual([]);
  await expect(page.getByRole("radio", { name: "Browser", exact: true })).toBeVisible();
  await expect(editor).toBeHidden();
  await expect(page.getByTestId("send-message-button")).toBeDisabled();
  await page.getByRole("button", { name: "Skip", exact: true }).click();
  await expect(editor).toHaveText("Keep my draft");
  await expect(page.getByText("draft.txt", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Remove Goal", exact: true })).toBeVisible();
  await editor.focus();
  await expect
    .poll(() =>
      editor.evaluate((element) => {
        const selection = window.getSelection();
        if (!selection || !element.contains(selection.anchorNode)) return null;
        return { start: selection.anchorOffset, end: selection.focusOffset, text: selection.toString() };
      }),
    )
    .toEqual({ start: 2, end: 6, text: "ep m" });
  const history = await (await request.get(`${url}/conversation`)).json();
  expect(history.messages.filter((message: { role: string }) => message.role === "user")).toHaveLength(2);
  await page.screenshot({ path: test.info().outputPath("async-draft-restored.png") });
});
