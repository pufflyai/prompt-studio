import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium, expect } from "@playwright/test";
import { folderProjectInput } from "../helpers/folder-project";
import { logTestPhase } from "../scripts/log-test-phase";
import { PROVISIONED_CHROMIUM } from "./packaged-chromium";
import { expectPackagedCollapsedMessage } from "./packaged-collapsed-message-smoke";

export const expectPackagedChatComposer = async (baseUrl: string, headers: Record<string, string>, root: string) => {
  const startedAt = Date.now();
  const phase = (name: string) => logTestPhase(`Packaged composer: ${name} (${Date.now() - startedAt}ms)`);
  const folder = join(root, "chat-project");
  // Guessed paths in chat become links only when the files exist.
  mkdirSync(join(folder, "src", "app", "(dashboard)"), { recursive: true });
  writeFileSync(join(folder, "src", "app.ts"), "export {};\n");
  writeFileSync(join(folder, "src", "app", "(dashboard)", "page.ts"), "export {};\n");
  const response = await fetch(`${baseUrl}/v1/projects`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify(
      folderProjectInput({ name: "Chat composer", agents: ["pstdio.workbench-fixture.harness.fake"] }, folder),
    ),
  });
  expect(response.ok).toBe(true);
  const project = (await response.json()) as { id: string };
  const browser = await chromium.launch(PROVISIONED_CHROMIUM);
  try {
    const page = await browser.newPage({ extraHTTPHeaders: headers });
    await page.addInitScript((projectId) => {
      localStorage.setItem("onboarding-complete", "true");
      localStorage.setItem("dashboard-wb2:selected-project:global", projectId);
    }, project.id);
    await page.goto(`${baseUrl}/projects/${project.id}/sessions`);
    phase("dashboard opened");
    await page
      .locator('[data-workbench-panel="main"]')
      .getByRole("group", { name: "Available tabs" })
      .getByRole("button", { name: "New session", exact: true })
      .click();
    const editor = page.getByTestId("content-editable").filter({ visible: true }).last();
    const send = page.getByTestId("send-message-button").filter({ visible: true }).last();
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
    phase("creation draft handed off");
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
    phase("follow-up draft handed off");

    for (const recalled of [next, prompt]) {
      await editor.press("ArrowUp");
      await expect(editor).toHaveText(recalled);
      await expect(editor).toBeFocused();
    }
    await editor.press("ArrowDown");
    await expect(editor).toHaveText(next);
    await editor.press("ArrowDown");
    await expect(editor).toBeEmpty();
    phase("prompt history recalled through saved drafts");

    const equations =
      "Packaged equations: $x^2$\n\n$$\n\\frac{1}{2}\n$$\n\nRead src/app.ts and src/app/(dashboard)/page.ts, not src/missing.ts. Open {{link('https://example.com')}}. End equations.";
    await editor.fill(equations);
    await editor.press("Enter");
    const reply = page.locator(".ai-message__root").filter({ hasText: "Fake Agent: follow-up" }).last();
    await expect(reply).toContainText("Packaged equations:");
    await expect(reply.locator(".katex")).toHaveCount(2);
    await expect(reply.locator(".katex-display")).toBeVisible();
    await expect(reply.locator(".katex-error")).toHaveCount(0);
    const plainPath = reply.getByRole("link", { name: "src/app.ts", exact: true });
    await expect(plainPath).toBeVisible();
    await expect(plainPath.locator("svg.lucide-file-code")).toHaveCount(1);
    const groupedPath = reply.getByRole("link", { name: "src/app/(dashboard)/page.ts", exact: true });
    await expect(groupedPath).toBeVisible();
    await expect(groupedPath).toHaveAttribute("href", /src%2Fapp%2F%28dashboard%29%2Fpage\.ts/);
    await expect(reply.getByRole("link", { name: "/page.ts", exact: true })).toHaveCount(0);
    await expect(reply.getByRole("link", { name: "src/missing.ts", exact: true })).toHaveCount(0);
    const webReference = reply.getByRole("link", { name: "example.com", exact: true });
    await expect(webReference).toHaveAttribute("href", "https://example.com");
    await expect(webReference).toHaveAttribute("target", "_blank");
    await expect(webReference.locator('[data-scope="tooltip"]')).toHaveCount(0);

    await editor.fill(
      "| Task | Details |\n| --- | --- |\n| Review | Read the changes and confirm that shared tools work together for people who never read code. |",
    );
    await editor.press("Enter");
    // The saved turn replaces the optimistic message and its table controls.
    await expect(page.locator(".ai-message__root").filter({ hasText: "Fake Agent: follow-up" }).last()).toContainText(
      "Read the changes",
    );
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
    phase("rich messages checked");

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
    await expectPackagedCollapsedMessage(page, editor);
    phase("idle session and collapsed message checked");
  } finally {
    await browser.close();
  }
};
