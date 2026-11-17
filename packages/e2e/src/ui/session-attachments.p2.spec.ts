import { Buffer } from "node:buffer";
import { folderProjectInput } from "../helpers/folder-project";
import { expect, type Request, test } from "../scripts/session-test";
import { uiOrigin as apiBase } from "../ui-server";

const actionPath = "/extensions/commands/pstdio.session-browser.view.conversation.chat.onAction/execute";
const isSubmit = (request: Request) =>
  request.method() === "POST" &&
  request.url().endsWith(actionPath) &&
  request.postDataJSON()?.params?.action?.type === "submit";

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

const createProjectViaApi = async (
  request: import("@playwright/test").APIRequestContext,
  name: string,
  folderPath?: string,
) => {
  const res = await request.post(`${apiBase}/v1/projects`, {
    data: folderProjectInput({ name, agents: ["pstdio.workbench-fixture.harness.fake"] }, folderPath),
  });
  expect(res.ok()).toBe(true);
  return (await res.json()) as { id: string; name: string };
};

const bypassOnboarding = async (page: import("@playwright/test").Page, projectId: string) => {
  await page.addInitScript((selectedProjectId: string) => {
    localStorage.setItem("onboarding-complete", "true");
    localStorage.setItem("dashboard-wb2:selected-project:global", selectedProjectId);
    localStorage.setItem("selected-agent", "pstdio.workbench-fixture.harness.fake");
    localStorage.setItem(
      `pstdio-dashboard:command-params:recent-harness:${selectedProjectId}`,
      JSON.stringify({ harnessId: "pstdio.workbench-fixture.harness.fake" }),
    );
  }, projectId);
};

const openSessionsView = async (page: import("@playwright/test").Page) => {
  await page.goto("/");
  await expect(page.locator('[data-workbench-region="main"]')).toBeVisible();
  await page.keyboard.press("ControlOrMeta+KeyP");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("textbox").fill("> go to sessions");
  await dialog.getByText("Go to sessions", { exact: true }).click();
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

    const chooser = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "Attach files", exact: true }).click();
    await (await chooser).setFiles([
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
      (response) => isSubmit(response.request()) && response.status() === 200,
    );

    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    let submitCount = 0;
    await page.route(`**${actionPath}`, async (route) => {
      if (isSubmit(route.request())) {
        submitCount++;
        await held;
      }
      await route.continue();
    });
    const editor = page.getByTestId("content-editable").last();
    await editor.fill(prompt);
    await page.locator("[data-testid='send-message-button']").click();

    try {
      await expect(editor).toBeEmpty();
      await expect(page.getByText(prompt, { exact: true })).toHaveCount(1);
      await expect(page.getByRole("button", { name: "Remove diagram.png" })).toHaveCount(0);
      await expect(page.getByText("diagram.png", { exact: true })).toHaveCount(1);
      await expect(editor).toHaveAttribute("contenteditable", "false");
      await expect(page.locator("[data-workbench-region=main]").getByTestId("send-message-button")).toBeDisabled();
    } finally {
      release();
    }
    const createResponse = await createResponsePromise;
    await page.unroute(`**${actionPath}`);
    expect(submitCount).toBe(1);
    const createPayload = createResponse.request().postDataJSON() as {
      params: { action: { attachments: Array<{ id: string }> } };
    };
    expect(createPayload.params.action.attachments).toHaveLength(1);
    const created = await createResponse.json();
    expect(created.outcome.ok).toBe(true);
    const sessions = created.outcome.navigationRequests
      .map((target: { resource?: { type: string; id: string } }) => target.resource)
      .filter((resource: { type: string } | undefined) => resource?.type === "session");
    expect(sessions).toHaveLength(1);
    const session = sessions[0] as { id: string };

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
