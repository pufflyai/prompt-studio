import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { type APIRequestContext, expect, type Page, test } from "@playwright/test";
import { folderProjectInput } from "../helpers/folder-project";

const source = join(import.meta.dirname, "../../../../.pstdio/extensions/social-radar");

// A fixture command seeds one finished run in the extension's own storage. No agent or social account is used.
const seedCommand = `defineCommand({ id: "seed", title: "Seed radar", async run(ctx) {
  const now = new Date().toISOString();
  await ctx.storage.collection("runs").put("run-1", { id: "run-1", status: "done", sessionId: "session-1", startedAt: now, finishedAt: now, summary: "One review names Prompt Studio.", searches: { hn: 1 }, skippedSites: [{ site: "x", reason: "Browser unavailable" }] });
  await ctx.storage.collection("threads").put("thread-1", { id: "thread-1", runId: "run-1", site: "hn", url: "https://news.ycombinator.com/item?id=42", title: "Tried Prompt Studio for reviews", excerpt: "A review page in an evening.", topic: "Prompt Studio", mention: true, intent: "mention", relevance: 3, reason: "A first-hand review", status: "new", foundAt: now,
    snapshot: { takenAt: now, post: { author: "dana", body: "I built a review page in an evening." }, comments: [{ id: "c1", author: "sam", body: "How does it compare to Cursor?" }] },
    analysis: { summary: "People like the review page.", sentiment: "positive", replySentiment: { negative: 0, neutral: 1, positive: 2 }, topics: [{ label: "review flow", count: 2 }], questions: ["How does it compare to Cursor?"] } });
  await ctx.storage.collection("ideas").put("idea-1", { id: "idea-1", runId: "run-1", threadId: "thread-1", replyTo: "c1", body: "Different jobs.\\n\\nBuild the review tool here.", status: "new", createdAt: now });
  await ctx.storage.collection("threads").put("post-1", { id: "post-1", runId: "run-1", kind: "demo", site: "x", title: "Review page in ten minutes", draft: "I built a review page in ten minutes.", reason: "Two threads ask for it.", tags: ["#BuildInPublic"], basedOn: ["thread-1"], status: "new", foundAt: now });
  return {};
} })`;

const execute = async (request: APIRequestContext, projectId: string, command: string, params = {}) => {
  const response = await request.post(
    `/v1/projects/${projectId}/extensions/commands/pstdio.social-radar.command.${command}/execute`,
    { data: { params, source: "cli" } },
  );
  const body = await response.json();
  expect(body.outcome.ok, JSON.stringify(body)).toBe(true);
  return body.outcome.value;
};

const webviewsBuilt = async (request: APIRequestContext, projectId: string) => {
  const metadata = await (await request.get(`/v1/projects/${projectId}/extensions/ui`)).json();
  const views = metadata.views.filter(
    (view: { extensionId: string; body: { webview?: { moduleUrl?: string } } }) =>
      view.extensionId === "pstdio.social-radar" && view.body.webview,
  );
  if (views.length < 2) return false;
  for (const view of views) {
    const module = await request.get(view.body.webview.moduleUrl);
    if (!module.ok() || (await module.text()).includes("Extension webview build failed")) return false;
  }
  return true;
};

const shot = (page: Page, name: string) => page.screenshot({ path: test.info().outputPath(`${name}.png`) });

test("researches, answers and posts through the radar screens", async ({ page, request }) => {
  const fixtureRoot = join(source, "../../../__test-tmp__");
  mkdirSync(fixtureRoot, { recursive: true });
  const root = mkdtempSync(join(fixtureRoot, "social-radar-e2e-"));
  const installName = `social-radar-e2e-${crypto.randomUUID()}`;
  let projectId: string | undefined;
  try {
    cpSync(source, root, { recursive: true, filter: (path) => !path.includes("node_modules") });
    symlinkSync(join(source, "node_modules"), join(root, "node_modules"), "dir");
    const entry = join(root, "extension.ts");
    writeFileSync(
      entry,
      readFileSync(entry, "utf8")
        .replace("commands: Object.values(commands)", `commands: [...Object.values(commands), ${seedCommand}]`)
        .replace("defineExtension,", "defineCommand, defineExtension,"),
    );
    const created = await request.post("/v1/projects", { data: folderProjectInput({ name: "Social radar" }, root) });
    expect(created.ok(), await created.text()).toBe(true);
    projectId = (await created.json()).id as string;
    const enabled = await request.post(`/v1/projects/${projectId}/extensions/installed/${installName}/enable`, {
      data: {
        displayName: "Social radar",
        extensionId: "pstdio.social-radar",
        manifest: { id: "pstdio.social-radar", name: "social-radar" },
        name: "social-radar",
        sourceHash: crypto.randomUUID(),
        sourceKind: "local_path",
        sourcePath: root,
        sourceRef: null,
        version: "0.0.0",
      },
    });
    expect(enabled.ok()).toBe(true);
    await execute(request, projectId, "seed");
    await expect.poll(() => webviewsBuilt(request, projectId!)).toBe(true);
    await page.addInitScript((id) => {
      if (window !== window.parent) return;
      localStorage.setItem("onboarding-complete", "true");
      localStorage.setItem("dashboard-wb2:selected-project:global", id!);
    }, projectId);
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);

    // 01: the analysis page counts the saved tags.
    await page.goto(`/projects/${projectId}/extensions/pstdio.social-radar/social-radar`);
    const analysis = page.frameLocator('iframe[title="Social radar"]');
    await expect(analysis.getByText("Threads found")).toBeVisible();
    await expect(analysis.getByText("Tried Prompt Studio for reviews")).toBeVisible();
    await shot(page, "01-analysis");

    // 02: the Sidenav level lists Threads and Runs; the list shows badges after the title.
    await page.getByRole("option", { name: "Threads", exact: true }).click();
    await expect(page.getByText("Tried Prompt Studio for reviews", { exact: true })).toBeVisible();
    await expect(page.getByText("@ Mention").first()).toBeVisible();
    await shot(page, "02-threads");

    // 03: copy a reply idea from under the comment it answers, then mark it used.
    await page.getByText("Tried Prompt Studio for reviews", { exact: true }).click();
    // The host keeps visited thread pages mounted, so target the visible one.
    const thread = page.locator('iframe[title="Thread"]:visible').contentFrame();
    await expect(thread.getByText("How does it compare to Cursor?").first()).toBeVisible();
    await shot(page, "03-thread");
    await thread.getByRole("button", { name: "Copy reply" }).click();
    await page.bringToFront();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("Different jobs.\n\nBuild the review tool here.");
    await thread.getByRole("button", { name: "Mark used" }).click();
    await expect(thread.getByText("Used", { exact: true })).toBeVisible();

    // 04: a new post moves to Answered once its link is saved.
    await page.getByRole("option", { name: "Threads", exact: true }).click();
    await page.getByText("Review page in ten minutes", { exact: true }).click();
    await expect(thread.getByLabel("Draft post")).toBeVisible();
    await shot(page, "04-new-post");
    await thread.getByLabel("Post link").fill("https://x.com/prompt_studio/status/1");
    await thread.getByRole("button", { name: "Mark posted" }).click();
    await expect
      .poll(async () => (await execute(request, projectId!, "list-answered")).threads.map((item: { id: string }) => item.id))
      .toContain("post-1");

    // 05: the run's digest is a read-only document built from the run.
    await page.getByRole("option", { name: /^Today · / }).click();
    await page.getByRole("option", { name: "Digest", exact: true }).click();
    await expect(page.getByText("Coverage", { exact: true })).toBeVisible();
    await expect(page.getByText("Skipped: Browser unavailable")).toBeVisible();
    await shot(page, "05-digest");
  } finally {
    if (projectId) await request.delete(`/v1/projects/${projectId}`);
    rmSync(root, { recursive: true, force: true });
  }
});
