import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { folderProjectInput } from "../helpers/folder-project";

const source = join(import.meta.dirname, "../../../../.pstdio/extensions/social-radar");

test("copies a research draft, tracks posting, and saves research settings", async ({ page, request }) => {
  const fixtureRoot = join(source, "../../../__test-tmp__");
  mkdirSync(fixtureRoot, { recursive: true });
  const root = mkdtempSync(join(fixtureRoot, "social-radar-e2e-"));
  const installName = `social-radar-e2e-${crypto.randomUUID()}`;
  let projectId: string | undefined;
  try {
    // Seed through a fixture command in the extension's own storage scope. No real agent or social account is used.
    cpSync(source, root, { recursive: true, filter: (path) => !path.includes("node_modules") });
    symlinkSync(join(source, "node_modules"), join(root, "node_modules"), "dir");
    const entry = join(root, "extension.ts");
    writeFileSync(
      entry,
      readFileSync(entry, "utf8")
        .replace(
          "commands: Object.values(commands)",
          `commands: [...Object.values(commands), defineCommand({ id: "seed", title: "Seed digest", async run(ctx) {
      const startedAt = new Date().toISOString();
      await ctx.storage.collection("runs").put("run-1", { id: "run-1", status: "done", sessionId: "session-1", startedAt, summary: "One useful thread and one demo idea.", skippedSites: [{ site: "x", reason: "Browser unavailable" }] });
      await ctx.storage.collection("threads").put("thread-1", { id: "thread-1", runId: "run-1", site: "hn", url: "https://news.ycombinator.com/item?id=42", title: "Managing coding agents", excerpt: "I need a workbench.", topic: "coding agents", intent: "problem", relevance: 3, reason: "A concrete tool request", draftReply: "A shared workspace helps.\\n\\nKeep the task and agent together.", status: "new", foundAt: startedAt });
      await ctx.storage.collection("ideas").put("idea-1", { id: "idea-1", runId: "run-1", kind: "demo", title: "Show Social radar", body: "I built my daily research tool.", sites: ["x"], tags: ["#BuildInPublic"], basedOn: ["abc123"], status: "new", createdAt: startedAt });
      return {};
    } })]`,
        )
        .replace("defineExtension,", "defineCommand, defineExtension,"),
    );
    const created = await request.post("/v1/projects", { data: folderProjectInput({ name: "Social radar" }, root) });
    expect(created.ok(), await created.text()).toBe(true);
    projectId = (await created.json()).id;
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
    const seeded = await request.post(
      `/v1/projects/${projectId}/extensions/commands/pstdio.social-radar.command.seed/execute`,
      { data: { params: {}, source: "cli" } },
    );
    expect(seeded.ok()).toBe(true);
    expect((await seeded.json()).outcome.ok).toBe(true);
    await expect
      .poll(async () => {
        const metadata = await (await request.get(`/v1/projects/${projectId}/extensions/ui`)).json();
        const view = metadata.views.find(
          (view: { localId: string; extensionId: string }) =>
            view.localId === "digest" && view.extensionId === "pstdio.social-radar",
        );
        if (!view?.body.webview.moduleUrl) return false;
        const module = await request.get(view.body.webview.moduleUrl);
        const body = await module.text();
        return module.ok() && !body.includes("Extension webview build failed");
      })
      .toBe(true);
    await page.addInitScript((id) => {
      if (window !== window.parent) return;
      localStorage.setItem("onboarding-complete", "true");
      localStorage.setItem("dashboard-wb2:selected-project:global", id!);
    }, projectId);
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto(`/projects/${projectId}/extensions/pstdio.social-radar/social-radar`);
    const frame = page.frameLocator('iframe[title="Social radar"]');
    await expect(frame.getByRole("heading", { name: "Social radar", exact: true })).toBeVisible();
    await expect(frame.getByText("Skipped x: Browser unavailable")).toBeVisible();
    await page.screenshot({ path: test.info().outputPath("social-radar.png"), fullPage: true });
    await frame.getByRole("button", { name: "Copy reply" }).click();
    await expect(frame.getByRole("button", { name: "Copied", exact: true })).toBeVisible();
    await page.bringToFront();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      "A shared workspace helps.\n\nKeep the task and agent together.",
    );
    await frame.getByRole("button", { name: "Mark posted" }).click();
    await expect(frame.getByText("Managing coding agents", { exact: true })).toHaveCount(0);
    await frame.getByRole("button", { name: "Posted", exact: true }).click();
    await expect(frame.getByText("Managing coding agents", { exact: true })).toBeVisible();
    await expect(frame.getByText("Outcome will be checked on the next run.")).toBeVisible();
    await frame.getByRole("button", { name: "Ideas", exact: true }).click();
    await frame.getByRole("button", { name: "Copy post" }).click();
    await expect(frame.getByRole("button", { name: "Copied", exact: true })).toBeVisible();
    await frame.getByRole("button", { name: "Mark used" }).click();
    await expect(frame.getByRole("heading", { name: "Show Social radar" })).toHaveCount(0);
    await frame.getByRole("button", { name: "Settings", exact: true }).click();
    await frame.getByRole("textbox", { name: "topics", exact: true }).fill("bespoke tools");
    await frame.getByRole("textbox", { name: "Writing voice", exact: true }).fill("Be brief and helpful.");
    await frame.getByRole("button", { name: "Save settings" }).click();
    await expect(frame.getByText("Settings saved.")).toBeVisible();
    const settings = await request.post(
      `/v1/projects/${projectId}/extensions/commands/pstdio.social-radar.command.get-settings/execute`,
      { data: { params: {}, source: "cli" } },
    );
    expect((await settings.json()).outcome.value).toMatchObject({
      topics: ["bespoke tools"],
      voice: "Be brief and helpful.",
    });
  } finally {
    if (projectId) await request.delete(`/v1/projects/${projectId}`);
    rmSync(root, { recursive: true, force: true });
  }
});
