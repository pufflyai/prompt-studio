import { Buffer } from "node:buffer";
import { expect, test } from "@playwright/test";

const apiPort = Number(process.env.E2E_API_PORT ?? "3200");
const apiBase = `http://localhost:${apiPort}`;

type ConversationMessage = {
  role?: string;
  parts?: Array<Record<string, unknown>>;
};

const imagePng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
  "base64",
);

const deleteAllProjects = async (request: import("@playwright/test").APIRequestContext) => {
  const res = await request.get(`${apiBase}/v1/projects`);
  expect(res.ok()).toBe(true);
  const projects = (await res.json()) as { id: string }[];
  for (const project of projects) {
    const del = await request.delete(`${apiBase}/v1/projects/${project.id}`);
    expect(del.ok()).toBe(true);
  }
};

const createProjectViaApi = async (request: import("@playwright/test").APIRequestContext, name: string) => {
  const res = await request.post(`${apiBase}/v1/projects`, {
    data: { name, agents: ["pstdio.harness-lab.fake"] },
  });
  expect(res.ok()).toBe(true);
  return (await res.json()) as { id: string; name: string };
};

const bypassOnboarding = async (page: import("@playwright/test").Page, projectId: string) => {
  await page.addInitScript((selectedProjectId: string) => {
    localStorage.setItem("onboarding-complete", "true");
    localStorage.setItem("dashboard-wb:selected-project:global", selectedProjectId);
    localStorage.setItem("selected-agent", "pstdio.harness-lab.fake");
    localStorage.setItem(
      `pstdio-dashboard:command-params:recent-harness:${selectedProjectId}`,
      JSON.stringify({ harnessId: "pstdio.harness-lab.fake" }),
    );
  }, projectId);
};

const openSessionsView = async (page: import("@playwright/test").Page) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: /Session Attachment Test Project/ })).toBeVisible();
  await page.keyboard.press("Control+Shift+P");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("textbox").fill("> open sessions");
  await page.locator("text=Open sessions").first().click();
};

const fetchConversationMessages = async (request: import("@playwright/test").APIRequestContext, sessionId: string) => {
  const res = await request.get(`${apiBase}/v1/sessions/${sessionId}/conversation`);
  expect(res.ok()).toBe(true);
  const body = (await res.json()) as { messages: ConversationMessage[] };
  return body.messages;
};

test.describe("Session attachments", () => {
  let projectId: string;

  test.beforeEach(async ({ request }) => {
    test.setTimeout(20_000);
    await deleteAllProjects(request);
    const project = await createProjectViaApi(request, "Session Attachment Test Project");
    projectId = project.id;
  });

  test("previews, removes, submits, and persists draft attachments for the agent", async ({ page, request }) => {
    await bypassOnboarding(page, projectId);
    await openSessionsView(page);

    await page.locator("input[type='file']").setInputFiles([
      {
        name: "diagram.png",
        mimeType: "image/png",
        buffer: imagePng,
      },
      {
        name: "notes.txt",
        mimeType: "text/plain",
        buffer: Buffer.from("agent-visible text context"),
      },
    ]);

    await expect(page.getByText("diagram.png")).toBeVisible();
    await expect(page.getByAltText("diagram.png preview thumbnail")).toBeVisible();
    await expect(page.getByText("notes.txt")).toBeVisible();

    await page.getByText("diagram.png").click();
    const previewDialog = page.getByRole("dialog", { name: "diagram.png" });
    await expect(previewDialog).toBeVisible();
    await expect(previewDialog.getByRole("img", { name: "diagram.png preview", exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "diagram.png" })).toHaveCount(0);

    await page.getByRole("button", { name: "Remove notes.txt" }).click();
    await expect(page.getByText("notes.txt")).toHaveCount(0);

    const prompt = "Use the attached diagram in your answer";
    const createResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" && response.url().endsWith("/v1/sessions") && response.status() === 201,
    );

    await page.locator("[data-testid='content-editable']").fill(prompt);
    await page.locator("[data-testid='send-message-button']").click();

    const createResponse = await createResponsePromise;
    const createRequest = createResponse.request();
    const createPayload = createRequest.postDataJSON() as { attachments?: Array<{ file_id: string }> };
    expect(createPayload.attachments).toHaveLength(1);
    const session = (await createResponse.json()) as { id: string };

    await expect(page.getByText(`Fake Agent: completed "${prompt}"`).first()).toBeVisible();
    await expect
      .poll(async () => {
        const messages = await fetchConversationMessages(request, session.id);
        const userParts = messages.find((message) => message.role === "user")?.parts ?? [];
        return userParts.filter((part) => part.type === "file").map((part) => part.filename);
      })
      .toEqual(["diagram.png"]);

    await expect(page.getByText("diagram.png").first()).toBeVisible();
  });
});
