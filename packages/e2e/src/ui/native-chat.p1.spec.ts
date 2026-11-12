import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { folderProjectInput } from "../helpers/folder-project";
import { expect, test } from "../scripts/session-test";

// Critical risk: a delayed extension command must never gate the native composer or lose a typed draft.
test("independent native chat paints and accepts input before history, then retains its draft across reload", async ({
  page,
  request,
}) => {
  const parent = resolve(import.meta.dirname, "../../../../__test-tmp__");
  mkdirSync(parent, { recursive: true });
  const sourcePath = mkdtempSync(join(parent, "native-chat-"));
  execFileSync("bun", [
    "build",
    join(import.meta.dirname, "../fixtures/native-chat/extension.ts"),
    "--target=bun",
    "--outfile",
    join(sourcePath, "extension.ts"),
  ]);
  writeFileSync(
    join(sourcePath, "package.json"),
    JSON.stringify({
      name: "native-chat",
      publisher: "acme",
      version: "0.1.0",
      main: "extension.ts",
      type: "module",
      engines: { pstdio: `^${EXTENSION_API_VERSION}` },
    }),
  );
  const projectPath = join(sourcePath, "project");
  mkdirSync(projectPath);
  let projectId: string | undefined;
  const blockedNativeReads = new Set<string>();
  let release!: () => void;
  const delayed = new Promise<void>((done) => {
    release = done;
  });
  try {
    const created = await request.post("/v1/projects", {
      data: folderProjectInput({ name: "Native chat" }, projectPath),
    });
    expect(created.ok()).toBe(true);
    projectId = (await created.json()).id;
    const upload = new FormData();
    upload.append("kind", "upload");
    upload.append("folderName", "native-chat");
    for (const name of ["package.json", "extension.ts"])
      upload.append("files", new File([readFileSync(join(sourcePath, name))], name));
    const installed = await request.post(`/v1/projects/${projectId}/extensions/install`, { multipart: upload });
    expect(installed.ok()).toBe(true);
    const seededDraft = await request.post(
      `/v1/projects/${projectId}/extensions/commands/acme.native-chat.view.conversation.chat.saveDraft/execute`,
      {
        data: {
          params: {
            draftKey: "compose",
            renderer: { rendererId: "acme.native-chat.view.conversation", projectId },
            draft: { text: "Earlier saved work", attachments: [], values: {} },
          },
        },
      },
    );
    expect(seededDraft.ok()).toBe(true);
    await page.addInitScript((id) => {
      if (window.top !== window) return;
      localStorage.setItem("onboarding-complete", "true");
      localStorage.setItem("dashboard-wb2:selected-project:global", id!);
    }, projectId);
    await page.route("**/extensions/commands/acme.native-chat.view.conversation.chat.query/execute", async (route) => {
      blockedNativeReads.add("query");
      await delayed;
      blockedNativeReads.delete("query");
      await route.continue();
    });
    await page.route(
      "**/extensions/commands/acme.native-chat.view.conversation.chat.loadDraft/execute",
      async (route) => {
        blockedNativeReads.add("draft");
        await delayed;
        blockedNativeReads.delete("draft");
        await route.continue();
      },
    );
    await page.goto(`/projects/${projectId}/extensions/acme.native-chat/chat`);
    const main = page.locator('[data-workbench-region="main"]');
    const composer = main.locator('[data-testid="content-editable"][contenteditable="true"]');
    await expect(composer).toBeVisible();
    // Project provisioning owns a blocking modal; native history and hydration are still independently held.
    await expect(page.getByRole("dialog", { name: "Opening Native chat", exact: true })).toHaveCount(0);
    await composer.fill("Unsent native draft");
    expect(blockedNativeReads).toEqual(new Set(["query", "draft"]));
    await expect(page.locator('iframe[title="Native conversation"]')).toHaveCount(0);
    release();
    await expect(main.getByText("Native transcript", { exact: true })).toBeVisible();
    await expect(composer).toContainText("Unsent native draft");
    await expect(main.getByText("Earlier saved work", { exact: true })).toBeVisible();
    const side = page.locator('[data-workbench-region="side"]');
    await page.getByRole("button", { name: "Show Side Panel", exact: true }).click();
    await expect(side.locator('[data-testid="content-editable"][contenteditable="true"]')).toBeVisible();
    await main.getByRole("button", { name: "Allow operation", exact: true }).click();
    await expect(main.getByText("Operation approved", { exact: true })).toBeVisible();
    const chooser = page.waitForEvent("filechooser");
    await main.getByRole("button", { name: "Attach files", exact: true }).click();
    await (await chooser).setFiles({
      name: "draft.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("Retained attachment"),
    });
    await expect(main.getByRole("button", { name: "Remove draft.txt" })).toBeVisible();
    // Critical risk: protected provider images must preview without consuming/removing the draft file.
    const imageChooser = page.waitForEvent("filechooser");
    await main.getByRole("button", { name: "Attach files", exact: true }).click();
    await (await imageChooser).setFiles({
      name: "diagram.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
        "base64",
      ),
    });
    const thumbnail = main.getByRole("img", { name: "diagram.png preview thumbnail", exact: true });
    await expect(thumbnail).toBeVisible();
    await expect.poll(() => thumbnail.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBe(1);
    await main.getByText("diagram.png", { exact: true }).click();
    const preview = page.getByRole("dialog", { name: "diagram.png", exact: true });
    await expect(preview.getByRole("img", { name: "diagram.png preview", exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(preview).toHaveCount(0);
    await main.getByRole("button", { name: "Remove diagram.png", exact: true }).click();
    await expect(main.getByText("diagram.png", { exact: true })).toHaveCount(0);
    await expect(main.getByRole("button", { name: "Remove draft.txt", exact: true })).toBeVisible();
    // Wait for the actual extension-owned save, rather than making reload race its durability.
    await expect
      .poll(async () => {
        const response = await request.post(
          `/v1/projects/${projectId}/extensions/commands/acme.native-chat.view.conversation.chat.loadDraft/execute`,
          {
            data: {
              projectId,
              params: {
                draftKey: "compose",
                renderer: {
                  rendererId: "acme.native-chat.view.conversation",
                  projectId,
                  invocation: { placement: "visible" },
                },
              },
              slot: { id: "acme.native-chat.view.conversation", kind: "renderer", context: { projectId } },
            },
          },
        );
        return (await response.json()).outcome?.value;
      })
      .toMatchObject({
        text: "Unsent native draft",
        attachments: [{ name: "draft.txt" }],
        recovered: [{ text: "Earlier saved work" }],
      });
    await page.reload();
    await expect(composer).toContainText("Unsent native draft");
    await expect(main.getByRole("button", { name: "Remove draft.txt" })).toBeVisible();
    // Critical risk: answering a question must not send or consume the saved message draft.
    await main.getByRole("button", { name: "Ask a question", exact: true }).click();
    await main.getByRole("radiogroup").getByText("Browser", { exact: true }).click();
    await main.getByRole("button", { name: "Send answer", exact: true }).click();
    await expect(main.getByText("Question answered", { exact: true })).toBeVisible();
    await expect(composer).toContainText("Unsent native draft");
    await expect(main.getByRole("button", { name: "Remove draft.txt" })).toBeVisible();
    // Critical risk: host services must preserve independent provider URI/image callbacks and saved queue settings.
    const authenticatedModels: string[] = [];
    await page.route("**/v1/agents/*/authentication?*", async (route) => {
      const model = new URL(route.request().url()).searchParams.get("model") ?? "";
      authenticatedModels.push(model);
      await route.fulfill({ json: { status: model === "B" ? "not_required" : "signed_out", providers: [] } });
    });
    await main.getByRole("button", { name: "Show saved queue", exact: true }).click();
    await expect.poll(() => authenticatedModels.includes("A")).toBe(true);
    // The transcript follows the queue to the bottom; bring this lazy image's paragraph back into view.
    await main.getByRole("link", { name: "Provider document" }).scrollIntoViewIfNeeded();
    const providerImage = main.getByRole("img", { name: "Provider image" });
    await expect(providerImage).toBeVisible();
    await expect.poll(() => providerImage.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBe(1);
    await main.getByRole("link", { name: "Provider document" }).click();
    await expect(main.getByText("Provider link opened", { exact: true })).toBeVisible();
    await main.getByRole("button", { name: "Edit queued message: Saved queued prompt", exact: true }).click();
    await expect.poll(() => authenticatedModels.includes("B")).toBe(true);
    await composer.fill("Edited prompt only");
    await main.getByRole("button", { name: "Update", exact: true }).click();
    await expect(main.getByText("Queue update kept B", { exact: true })).toBeVisible();
    // Critical risk: later streaming must not disable forks of completed earlier replies.
    await main.getByRole("button", { name: "Show running replies", exact: true }).click();
    const fork = main.getByRole("button", { name: "Fork conversation", exact: true });
    await expect(fork).toHaveCount(1);
    await main.locator('[data-chat-message-id="completed-reply"]').hover();
    await fork.click();
    await expect(main.getByText("Earlier reply forked while work continues", { exact: true })).toBeVisible();
    await expect(main.getByText("Still working", { exact: true })).toBeVisible();
    // Critical risk: polling must not undo Skip/Cancel/approval or dismiss another pending mode.
    await main.getByRole("button", { name: "Show pending decisions", exact: true }).click();
    await main.getByRole("button", { name: "Skip", exact: true }).click();
    await main.getByRole("button", { name: "Cancel", exact: true }).click();
    await main.getByRole("button", { name: "Refresh pending decisions", exact: true }).click();
    await expect(main.getByRole("button", { name: "Skip", exact: true })).toHaveCount(0);
    await main.getByRole("button", { name: "Reopen goal decision", exact: true }).click();
    await main.getByRole("button", { name: "Approve native decision", exact: true }).click();
    await main.getByRole("button", { name: "Refresh pending decisions", exact: true }).click();
    await expect(main.getByRole("button", { name: "Skip", exact: true })).toHaveCount(0);
    await main.getByRole("button", { name: "Revise plan decision", exact: true }).click();
    await main.getByRole("button", { name: "Skip", exact: true }).click();
    await expect(main.getByRole("button", { name: "Skip", exact: true })).toHaveCount(0);
    await expect(composer).toContainText("Unsent native draft");
  } finally {
    release();
    await page.unrouteAll({ behavior: "wait" });
    if (projectId) await request.delete(`/v1/projects/${projectId}`);
    rmSync(sourcePath, { recursive: true, force: true });
  }
});
