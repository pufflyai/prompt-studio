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
    await page.unroute("**/follow-up");

    const equations = "Packaged equations: $x^2$\n\n$$\n\\frac{1}{2}\n$$\n\nEnd equations.";
    await editor.fill(equations);
    await editor.press("Enter");
    const reply = page.locator(".ai-message__root").filter({ hasText: "Fake Agent: follow-up" }).last();
    await expect(reply).toContainText("Packaged equations:");
    await expect(reply.locator(".katex")).toHaveCount(2);
    await expect(reply.locator(".katex-display")).toBeVisible();
    await expect(reply.locator(".katex-error")).toHaveCount(0);

    await editor.fill(
      "| Task | Details |\n| --- | --- |\n| Review | Read the changes and confirm that shared tools work together for people who never read code. |",
    );
    await editor.press("Enter");
    const table = page.getByRole("log").locator('table[data-edit-mode="true"]').last();
    const detail = table.getByRole("cell", { name: /Read the changes/ });
    await expect(detail).toBeVisible();
    await expect(table.locator('[data-column-id="rowIndex"]')).toHaveCount(0);
    await expect(table.locator("col")).toHaveCount(2);
    await expect(detail).toHaveCSS("white-space", "normal");
    await table.getByRole("button", { name: "Display settings" }).click();
    const wrap = page.getByRole("switch", { name: "Wrap rows" });
    await expect(wrap).toBeChecked();
    await page.getByText("Wrap rows", { exact: true }).click();
    await expect(detail).toHaveCSS("white-space", "nowrap");
    await page.getByText("Wrap rows", { exact: true }).click();
    await page.keyboard.press("Escape");

    const idleResponse = await fetch(`${baseUrl}/v1/sessions`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        project_id: project.id,
        title: "Idle connection",
        agent: "pstdio.workbench-fixture.harness.fake",
      }),
    });
    expect(idleResponse.status).toBe(201);
    const idle = (await idleResponse.json()) as { id: string };
    expect(idle).toMatchObject({
      status: "completed",
      agent_session_id: null,
      last_request_started: null,
      last_request_ended: null,
    });
    await page.goto(`${baseUrl}/projects/${project.id}/sessions`);
    await page.getByRole("option", { name: "Idle connection", exact: true }).click();
    await expect(page.locator(".ai-message__root")).toHaveCount(0);
    await editor.fill("First idle-session message");
    await expect(send).toBeEnabled();
    await editor.press("Enter");
    await expect(page.getByText('Fake Agent: completed "First idle-session message"').first()).toBeVisible();
  } finally {
    await browser.close();
  }
};
