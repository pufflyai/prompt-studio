import { expect, test } from "@playwright/test";

const apiPort = Number(process.env.E2E_API_PORT ?? "3200");
const apiBase = `http://localhost:${apiPort}`;
const questionPrompt = "Question follow-up test __fake_question_prompt__";

test("PS-119 answers a hydrated question tool call from the session composer", async ({ page, request }) => {
  const projectResponse = await request.post(`${apiBase}/v1/projects`, {
    data: { name: "PS-119 Question Prompt" },
  });
  expect(projectResponse.ok()).toBe(true);
  const project = (await projectResponse.json()) as { id: string };

  const sessionResponse = await request.post(`${apiBase}/v1/sessions`, {
    data: {
      project_id: project.id,
      title: questionPrompt,
      prompt: questionPrompt,
      agent: "pstdio.extension-lab.harness.fake",
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
    localStorage.setItem("selected-agent", "pstdio.extension-lab.harness.fake");
    localStorage.setItem("dashboard-wb:selected-project:global", projectId);
  }, project.id);

  await page.goto(`/projects/${project.id}/`);
  await page.getByRole("button", { name: new RegExp(questionPrompt) }).click();
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
