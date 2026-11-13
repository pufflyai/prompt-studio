import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium, expect, type Page } from "@playwright/test";
import { folderProjectInput } from "../helpers/folder-project";
import { isSessionChatAction, sessionChatActionRoute } from "../helpers/session-chat-actions";
import { logTestPhase } from "../scripts/log-test-phase";
import type { ComposerObservation } from "./composer-observation";
import { PACKAGED_DASHBOARD_BROWSER } from "./packaged-chromium";
import { expectPackagedCollapsedMessage } from "./packaged-collapsed-message-smoke";

const preserveComposerFailure = async (page: Page) => {
  const evidence = join(import.meta.dir, "../../test-results", `packaged-composer-${Date.now()}-${process.pid}`);
  mkdirSync(evidence, { recursive: true });
  await Promise.allSettled([
    page.context().tracing.stop({ path: join(evidence, "trace.zip") }),
    page.screenshot({ path: join(evidence, "failure.png") }),
    page.content().then((html) => writeFileSync(join(evidence, "failure.html"), html)),
  ]);
  console.error(`Packaged composer failure evidence: ${evidence}`);
};

export const expectPackagedChatComposer = async (
  baseUrl: string,
  headers: Record<string, string>,
  root: string,
  observe: ComposerObservation,
) => {
  const startedAt = Date.now();
  const phase = (name: string) => logTestPhase(`Packaged composer: ${name} (${Date.now() - startedAt}ms)`);
  const folder = join(root, "chat-project");
  // Guessed paths in chat become links only when the files exist.
  mkdirSync(join(folder, "src", "app", "(dashboard)"), { recursive: true });
  writeFileSync(join(folder, "src", "app.ts"), "export {};\n");
  writeFileSync(join(folder, "src", "app", "(dashboard)", "page.ts"), "export {};\n");
  observe("project.request.begin");
  const response = await fetch(`${baseUrl}/v1/projects`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify(
      folderProjectInput({ name: "Chat composer", agents: ["pstdio.workbench-fixture.harness.fake"] }, folder),
    ),
  });
  observe("project.request.end", { status: response.status });
  expect(response.ok).toBe(true);
  observe("project.body.begin");
  const project = (await response.json()) as { id: string };
  observe("project.body.end", { projectId: project.id });
  observe("browser.launch.begin");
  const browser = await chromium.launch(PACKAGED_DASHBOARD_BROWSER);
  observe("browser.launch.end");
  let page: Page | undefined;
  let releaseDestinationRead = () => {};
  try {
    observe("browser.page.begin");
    page = await browser.newPage({ extraHTTPHeaders: headers });
    observe("browser.page.end");
    observe("browser.trace.begin");
    await page.context().tracing.start({ screenshots: true, snapshots: true, sources: true });
    observe("browser.trace.end");
    observe("browser.configure.begin");
    let destinationReadStarted = false;
    const destinationRead = new Promise<void>((resolve) => {
      releaseDestinationRead = resolve;
    });
    const queryRoute = `**/v1/projects/${project.id}/extensions/commands/pstdio.pstdio-session-browser.view.conversation.chat.query/execute`;
    await page.route(queryRoute, async (route) => {
      const body = route.request().postDataJSON();
      if (!destinationReadStarted && body?.params?.renderer?.resource?.type === "session") {
        destinationReadStarted = true;
        await destinationRead;
      }
      await route.continue();
    });
    await page.addInitScript((projectId) => {
      localStorage.setItem("onboarding-complete", "true");
      localStorage.setItem("dashboard-wb2:selected-project:global", projectId);
    }, project.id);
    observe("browser.configure.end");
    observe("navigation.initial.begin");
    await page.goto(`${baseUrl}/projects/${project.id}/sessions`);
    observe("navigation.initial.end");
    phase("dashboard opened");
    const editor = page.getByTestId("content-editable").filter({ visible: true }).last();
    const send = page.getByTestId("send-message-button").filter({ visible: true }).last();
    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route(sessionChatActionRoute, async (route) => {
      if (isSessionChatAction(route.request(), "submit")) await held;
      await route.continue();
    });
    const prompt = "Packaged composer first message";
    observe("editor.first-fill.begin");
    await editor.fill(prompt);
    observe("editor.first-fill.end");
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
    await page.unroute(sessionChatActionRoute);
    phase("creation draft handed off");
    await expect.poll(() => destinationReadStarted).toBe(true);
    const next = "Packaged composer follow-up";
    let releaseFollowUp!: () => void;
    const heldFollowUp = new Promise<void>((resolve) => {
      releaseFollowUp = resolve;
    });
    let followUpSubmits = 0;
    await page.route(sessionChatActionRoute, async (route) => {
      if (isSessionChatAction(route.request(), "submit")) {
        followUpSubmits++;
        await heldFollowUp;
      }
      await route.continue();
    });
    await editor.fill(next);
    // The stream can show the reply before the destination's finite read settles.
    // Typing stays available, but Enter must preserve the draft until Send is ready.
    await expect(send).toBeDisabled();
    await editor.press("Enter");
    await expect(editor).toHaveText(next);
    expect(followUpSubmits).toBe(0);
    releaseDestinationRead();
    await expect(send).toBeEnabled();
    await expect(editor).toHaveText(next);
    await page.unroute(queryRoute);
    await editor.press("Enter");
    try {
      await expect(editor).toBeEmpty();
      await expect(page.getByText(next, { exact: true })).toHaveCount(1);
      await expect.poll(() => followUpSubmits).toBe(1);
      await expect(editor).toHaveAttribute("contenteditable", "false");
      await expect(send).toBeDisabled();
    } finally {
      releaseFollowUp();
    }
    await expect(editor).toHaveAttribute("contenteditable", "true");
    await expect(editor).toBeFocused();
    await page.unroute(sessionChatActionRoute);
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
    observe("equations.submit.begin");
    await editor.fill(equations);
    await editor.press("Enter");
    observe("equations.submit.end");
    observe("equations.render-and-links.begin");
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

    observe("equations.render-and-links.end");
    observe("file.open.begin");
    await plainPath.click();
    observe("file.open.click.end");
    await expect(page.locator(".monaco-editor .view-lines")).toContainText("export");
    observe("file.open.content.end");
    observe("navigation.reload.begin");
    await page.reload();
    observe("navigation.reload.load.end");
    await expect(page.locator(".monaco-editor .view-lines")).toContainText("export");
    observe("navigation.reload.content.end");
    observe("navigation.back.begin");
    await page.goBack();
    observe("navigation.back.load.end");
    await expect(plainPath).toBeVisible();
    observe("navigation.back.content.end");
    phase("conversation restored through file navigation, reload and Back");

    observe("rich-table.begin");
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
    observe("rich-table.end");

    observe("idle.create.begin");
    const idleResponse = await fetch(`${baseUrl}/v1/sessions`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        project_id: project.id,
        title: "Idle connection",
        agent: "pstdio.workbench-fixture.harness.fake",
      }),
    });
    observe("idle.create.response", { status: idleResponse.status });
    expect(idleResponse.status).toBe(201);
    const idle = (await idleResponse.json()) as { id: string };
    observe("idle.create.body.end");
    expect(idle).toMatchObject({
      status: "completed",
      agent_session_id: null,
      last_request_started: null,
      last_request_ended: null,
    });
    observe("idle.navigation.begin");
    await page.goto(`${baseUrl}/projects/${project.id}/sessions`);
    observe("idle.navigation.end");
    observe("idle.select.begin");
    await page.getByRole("option", { name: "Idle connection", exact: true }).click();
    observe("idle.select.end");
    await expect(page.locator(".ai-message__root")).toHaveCount(0);
    observe("idle.fill.begin");
    await editor.fill("First idle-session message");
    observe("idle.fill.end");
    observe("idle.send-ready.begin");
    await expect(send).toBeEnabled();
    observe("idle.send-ready.end");
    observe("idle.submit.begin");
    await editor.press("Enter");
    observe("idle.submit.end");
    observe("idle.reply.begin");
    await expect(page.getByText('Fake Agent: completed "First idle-session message"').first()).toBeVisible();
    observe("idle.reply.end");
    observe("idle.collapsed.begin");
    await expectPackagedCollapsedMessage(page, editor);
    observe("idle.collapsed.end");
    phase("idle session and collapsed message checked");
  } catch (error) {
    observe("composer.failure");
    if (page)
      await preserveComposerFailure(page).catch((failure) =>
        console.error("Could not preserve composer failure", failure),
      );
    throw error;
  } finally {
    releaseDestinationRead();
    observe("browser.close.begin");
    await browser.close();
    observe("browser.close.end");
  }
};
