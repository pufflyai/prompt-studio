import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { expect, test } from "@playwright/test";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { folderProjectInput } from "../helpers/folder-project";

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
    const installed = await request.post(`/v1/projects/${projectId}/extensions/installed/native-chat/enable`, {
      data: {
        displayName: "Native chat",
        extensionId: "acme.native-chat",
        manifest: { id: "acme.native-chat", name: "native-chat" },
        name: "native-chat",
        sourceHash: "native-chat",
        sourceKind: "local_path",
        sourcePath,
        sourceRef: null,
        version: "0.1.0",
      },
    });
    expect(installed.ok()).toBe(true);
    await page.addInitScript((id) => {
      if (window.top !== window) return;
      localStorage.setItem("onboarding-complete", "true");
      localStorage.setItem("dashboard-wb2:selected-project:global", id!);
    }, projectId);
    await page.route("**/extensions/commands/acme.native-chat.view.conversation.chat.query/execute", async (route) => {
      await delayed;
      await route.continue();
    });
    await page.goto(`/projects/${projectId}/extensions/acme.native-chat/chat`);
    const main = page.locator('[data-workbench-region="main"]');
    const composer = main.locator('[data-testid="content-editable"][contenteditable="true"]');
    await expect(composer).toBeVisible();
    await composer.fill("Unsent native draft");
    await expect(page.locator('iframe[title="Native conversation"]')).toHaveCount(0);
    release();
    await expect(main.getByText("Native transcript", { exact: true })).toBeVisible();
    await expect(composer).toContainText("Unsent native draft");
    const side = page.locator('[data-workbench-region="side"]');
    await page.getByRole("button", { name: "Show Side Panel", exact: true }).click();
    await expect(side.locator('[data-testid="content-editable"][contenteditable="true"]')).toBeVisible();
    await main.getByRole("button", { name: "Allow operation", exact: true }).click();
    await expect(main.getByText("Operation approved", { exact: true })).toBeVisible();
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
        return (await response.json()).outcome?.value?.text;
      })
      .toBe("Unsent native draft");
    await page.reload();
    await expect(composer).toContainText("Unsent native draft");
  } finally {
    release();
    await page.unrouteAll({ behavior: "wait" });
    if (projectId) await request.delete(`/v1/projects/${projectId}`);
    rmSync(sourcePath, { recursive: true, force: true });
  }
});
