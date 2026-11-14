import { strict as assert } from "node:assert";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, type Page } from "@playwright/test";
import { conversationFixture } from "pstdio-benchmarks/writer";
import { memoryRequest, type readMemoryRuntime } from "../desktop-memory-app";

type Runtime = NonNullable<ReturnType<typeof readMemoryRuntime>>;
export const navigate = async (page: Page, path: string) => {
  await page.evaluate((path) => {
    history.pushState(null, "", path);
    dispatchEvent(new PopStateEvent("popstate"));
  }, path);
};
export const request = memoryRequest;
export const wait = async (predicate: () => Promise<boolean>, description: string, signal: AbortSignal) => {
  const started = performance.now();
  while (!(await predicate())) {
    signal.throwIfAborted();
    if (performance.now() - started >= 30_000) throw new Error(`Timed out waiting for ${description}`);
    await Bun.sleep(100);
  }
};
export const workbench = async (
  browser: { contexts: () => { pages: () => Page[] }[] },
  runtime: Runtime,
  signal: AbortSignal,
) => {
  let page: Page | undefined;
  await wait(
    async () => {
      page = browser
        .contexts()[0]
        ?.pages()
        .find((candidate) => candidate.url().startsWith(runtime.origin));
      return Boolean(page);
    },
    "workbench page",
    signal,
  );
  await page!.addInitScript(() => {
    if (window === window.top) localStorage.setItem("onboarding-complete", "true");
  });
  await expect(page!.locator("#root")).not.toBeEmpty();
  return page!;
};

/** B2/B3/B4/B5/B8 use the same checked conversation, file and idle terminal fixture. */
export const seedProject = async (
  runtime: Runtime,
  page: Page,
  home: string,
  signal: AbortSignal,
  name = "Critical workload",
) => {
  const projectPath = join(home, name.replaceAll(" ", "-").toLowerCase());
  mkdirSync(projectPath, { recursive: true });
  writeFileSync(join(projectPath, conversationFixture.file.name), conversationFixture.file.content);
  const project = await request(runtime, "/projects", {
    name,
    initial_workspace: { provider_id: "pstdio.root", params: { path: projectPath } },
  });
  assert.equal(
    project.extension_warnings?.length ?? 0,
    0,
    `Default tool setup failed: ${JSON.stringify(project.extension_warnings)}`,
  );
  const session = await request(runtime, "/sessions", {
    project_id: project.id,
    title: `${name} conversation`,
    agent: "pstdio.workbench-fixture.harness.fake",
  });
  for (let index = 0; index < conversationFixture.turns; index++) {
    await request(runtime, `/sessions/${session.id}/follow-up`, {
      prompt: `Message ${index + 1}: ${conversationFixture.prompt}`,
    });
    await wait(
      async () => (await request(runtime, `/sessions/${session.id}`)).status === "completed",
      "completed conversation turn",
      signal,
    );
  }
  const conversation = await request(runtime, `/sessions/${session.id}/conversation`);
  assert.equal(conversation.messages.length, conversationFixture.messages);
  await page.goto(`${runtime.origin}/projects/${project.id}/sessions`);
  const openConversation = async () => {
    await navigate(page, `/projects/${project.id}/sessions`);
    await page.getByRole("option", { name: session.title, exact: true }).click();
    await page.locator('[data-testid="content-editable"][contenteditable="true"]:visible').waitFor();
  };
  await openConversation();
  const showBottom = page.getByRole("button", { name: "Show Bottom Panel", exact: true });
  if (await showBottom.isVisible()) await showBottom.click();
  await page
    .locator('[data-workbench-panel-header="secondary"]')
    .getByRole("button", { name: "Add panel", exact: true })
    .click();
  await page.getByRole("menuitem", { name: "Open terminal", exact: true }).click();
  const terminal = page.getByRole("textbox", { name: "Terminal input" });
  await terminal.fill(conversationFixture.terminal);
  await terminal.press("Enter");
  await expect(page.locator(".xterm:visible .xterm-rows")).toContainText("__memory_idle__");
  await navigate(page, `/projects/${project.id}/workspaces`);
  const workspace = (await request(runtime, `/workspaces?project_id=${project.id}`))[0];
  await page
    .getByRole("region", { name: "Main", exact: true })
    .getByRole("option")
    .filter({ hasText: workspace.workspace_shorthand })
    .click();
  await page
    .getByRole("region", { name: "Files", exact: true })
    .getByRole("option", { name: conversationFixture.file.name, exact: true })
    .click();
  await page.locator(".monaco-editor:visible").waitFor();
  const filePath = new URL(page.url()).pathname + new URL(page.url()).search;
  return { project, session, filePath, expectedMessages: conversation.messages };
};
export type ProjectFixture = Awaited<ReturnType<typeof seedProject>>;
export const projectActions = (runtime: Runtime, page: Page, fixture: ProjectFixture) => ({
  async conversation() {
    const tab = page.getByRole("tab", { name: fixture.project.name, exact: true });
    if (await tab.count()) await tab.click();
    else {
      await page.getByRole("button", { name: /^Open (?:project|\/ create project)$/ }).click();
      await page.getByRole("dialog").getByText(fixture.project.name, { exact: true }).click();
    }
    await expect(tab).toHaveAttribute("aria-selected", "true");
    await navigate(page, `/projects/${fixture.project.id}/sessions`);
    await page.getByRole("option", { name: fixture.session.title, exact: true }).click();
    const composer = page.locator('[data-testid="content-editable"][contenteditable="true"]:visible');
    await composer.waitFor();
    return composer;
  },
  async file() {
    await navigate(page, fixture.filePath);
    await expect(page.locator(".monaco-editor:visible .view-lines")).toContainText("memoryWorkload");
  },
  async terminal() {
    const show = page.getByRole("button", { name: "Show Bottom Panel", exact: true });
    if (await show.isVisible()) await show.click();
    await expect(page.getByRole("textbox", { name: "Terminal input" })).toBeVisible();
  },
  async verify() {
    assert.equal(new URL(page.url()).pathname.split("/")[2], fixture.project.id, "The saved project was not restored");
    const conversation = await request(runtime, `/sessions/${fixture.session.id}/conversation`);
    assert.deepEqual(conversation.messages, fixture.expectedMessages, "Saved conversation changed");
    await this.conversation();
    const last = fixture.expectedMessages.at(-1).parts.find((part: { type: string }) => part.type === "text");
    assert(last?.text, "Saved response text missing");
    await expect(page.getByRole("log")).toContainText(last.text);
    await this.file();
    await this.terminal();
    const terminal = page.getByRole("textbox", { name: "Terminal input" });
    await terminal.fill("echo __critical_restored__");
    await terminal.press("Enter");
    await expect(
      page.locator(".xterm:visible .xterm-rows > div").filter({ hasText: /^__critical_restored__\s*$/ }),
    ).toBeVisible();
  },
});
