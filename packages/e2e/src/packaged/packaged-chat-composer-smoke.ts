import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium, expect } from "@playwright/test";
import { folderProjectInput } from "../helpers/folder-project";

export const expectPackagedChatComposer = async (baseUrl: string, headers: Record<string, string>, root: string) => {
  const folder = join(root, "chat-project");
  mkdirSync(folder);
  const response = await fetch(`${baseUrl}/v1/projects`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify(
      folderProjectInput({ name: "Chat composer", agents: ["pstdio.workbench-fixture.harness.fake"] }, folder),
    ),
  });
  expect(response.ok).toBe(true);
  const project = (await response.json()) as { id: string };
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ extraHTTPHeaders: headers });
    await page.addInitScript((projectId) => {
      localStorage.setItem("onboarding-complete", "true");
      localStorage.setItem("dashboard-wb2:selected-project:global", projectId);
    }, project.id);
    await page.goto(`${baseUrl}/projects/${project.id}/sessions`);
    const editor = page.getByTestId("content-editable").last();
    const send = page.getByTestId("send-message-button").last();
    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route(`${baseUrl}/v1/sessions`, async (route) => {
      if (route.request().method() === "POST") await held;
      await route.continue();
    });
    const prompt = "Packaged composer first message";
    await editor.fill(prompt);
    // Sending stays blocked until the project's agents and models load.
    await expect(send).toBeEnabled();
    await editor.press("Enter");
    try {
      await expect(editor).toBeEmpty();
      await expect(page.getByText(prompt, { exact: true })).toHaveCount(1);
      await expect(editor).toHaveAttribute("contenteditable", "false");
      await expect(send).toBeDisabled();
    } finally {
      release();
    }
    await expect(page.getByText(`Fake Agent: completed "${prompt}"`).first()).toBeVisible();
    await page.unroute(`${baseUrl}/v1/sessions`);
    const next = "Packaged composer follow-up";
    let releaseFollowUp!: () => void;
    const heldFollowUp = new Promise<void>((resolve) => {
      releaseFollowUp = resolve;
    });
    await page.route("**/follow-up", async (route) => {
      await heldFollowUp;
      await route.continue();
    });
    await editor.fill(next);
    await editor.press("Enter");
    try {
      await expect(editor).toBeEmpty();
      await expect(page.getByText(next, { exact: true })).toHaveCount(1);
      await expect(editor).toHaveAttribute("contenteditable", "false");
      await expect(send).toBeDisabled();
    } finally {
      releaseFollowUp();
    }
    await expect(editor).toHaveAttribute("contenteditable", "true");
    await expect(editor).toBeFocused();
  } finally {
    await browser.close();
  }
};
