import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { folderProjectInput } from "../helpers/folder-project";
import { expect, test } from "../scripts/session-test";
import { uiOrigin } from "../ui-server";

// Global media emulation overrides embedding preferences in every iframe.
test.use({ colorScheme: null });

test("exports the displayed saved version as an interactive offline HTML file and recovers from errors", async ({
  page,
  request,
  browser,
}) => {
  const root = resolve(import.meta.dirname, "../../../../__test-tmp__");
  mkdirSync(root, { recursive: true });
  const repo = mkdtempSync(join(root, "artifact-export-"));
  execFileSync("git", ["init", "--quiet", repo]);
  const created = await request.post(`${uiOrigin}/v1/projects`, {
    data: folderProjectInput({ name: "Artifact export" }, repo),
  });
  expect(created.ok()).toBe(true);
  const project = (await created.json()) as { id: string };
  const execute = async (command: string, params: Record<string, unknown>) => {
    const response = await request.post(
      `${uiOrigin}/v1/projects/${project.id}/extensions/commands/pstdio.artifacts.command.${command}/execute`,
      { data: { params, source: "api" } },
    );
    expect(response.ok()).toBe(true);
    const body = await response.json();
    expect(body.outcome.status, body.outcome.reason).toBe("success");
    return body.outcome.value;
  };
  try {
    writeFileSync(
      join(repo, "page.html"),
      `<html style="--artifact-bg:red!important;margin:0"><head><title>Audit report</title><style>#scheme{font-weight:400}@media(prefers-color-scheme:dark){#scheme{font-weight:700}}</style></head><body><h1>Earlier audit</h1><button onclick="this.textContent='Complete'">Complete task</button><p id="scheme"></p><p id="isolation"></p><script>const m=matchMedia('(prefers-color-scheme:dark)');const update=()=>document.getElementById('scheme').textContent=m.matches?'dark':'light';m.addEventListener('change',update);update();try{parent.document.body;document.getElementById('isolation').textContent='exposed'}catch{document.getElementById('isolation').textContent='isolated'}</script></body></html>`,
    );
    const first = await execute("publish", { file_path: "page.html", label: "First" });
    writeFileSync(join(repo, "page.html"), "<title>Updated audit</title><h1>Latest audit</h1>");
    await execute("publish", { file_path: "page.html", url: first.url, label: "Updated" });
    rmSync(join(repo, "page.html"));
    await page.addInitScript((id) => {
      localStorage.setItem("dashboard-wb2:selected-project:global", id);
    }, project.id);
    await page.goto(first.url);
    const frame = page.frameLocator('iframe[title="Artifacts"]:visible').last();
    await frame.getByRole("button", { name: "Versions", exact: true }).click();
    await frame.getByRole("menuitemradio", { name: "First", exact: true }).click();
    const preview = frame.frameLocator('iframe[title^="Preview: "]').frameLocator("iframe");
    await expect(preview.getByRole("heading", { name: "Earlier audit" })).toBeVisible();
    const mode = await page.evaluate(() => (matchMedia("(prefers-color-scheme: dark)").matches ? "light" : "dark"));
    const background = mode === "dark" ? "rgb(16, 24, 32)" : "rgb(255, 255, 255)";
    await page.evaluate(
      ({ mode, background }) => {
        const root = document.querySelector<HTMLElement>("[data-ui-scope]:not([hidden])")!;
        root.style.colorScheme = mode;
        root.setAttribute("data-theme", mode);
        root.setAttribute("data-color-mode", mode);
        root.style.setProperty("--chakra-colors-bg", background);
        root.style.setProperty("--chakra-colors-fg", mode === "dark" ? "#ffffff" : "#000000");
      },
      { mode, background },
    );
    await expect(preview.locator("html")).toHaveAttribute("data-theme", mode);
    await expect(preview.locator("body")).toHaveCSS("background-color", background);
    await expect(preview.locator("#scheme")).toHaveText(mode);

    // A failed export must leave the selected version available for another attempt.
    const route = "**/pstdio.artifacts.command.export/execute";
    await page.route(route, (request) =>
      request.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          outcome: { ok: false, status: "rejected", code: "unavailable", reason: "Export unavailable" },
        }),
      }),
    );
    await frame.getByRole("button", { name: "Export HTML", exact: true }).click();
    await expect(frame.getByText(/Export unavailable/)).toBeVisible();
    await page.unroute(route);
    const downloaded = page.waitForEvent("download");
    await frame.getByRole("button", { name: "Export HTML", exact: true }).click();
    const file = await downloaded;
    expect(file.suggestedFilename()).toBe("Audit report.html");
    const destination = join(repo, "exported.html");
    await file.saveAs(destination);
    const html = readFileSync(destination, "utf8");
    expect(html).toContain("Earlier audit");
    expect(html).not.toContain("Latest audit");
    const cli = await execute("export", {
      url: first.url,
      revisionId: first.revisionId,
      file_path: "exports/cli.html",
    });
    expect(cli.path).toBe("exports/cli.html");
    expect(readFileSync(join(repo, cli.path), "utf8")).toContain("Earlier audit");
    const offline = await browser.newContext({
      offline: true,
      colorScheme: null,
      viewport: { width: 375, height: 812 },
      isMobile: true,
    });
    try {
      const exported = await offline.newPage();
      await exported.goto(pathToFileURL(destination).href);
      const content = exported.frameLocator("iframe");
      expect(await content.locator("body").evaluate(() => innerWidth)).toBe(375);
      await expect(content.locator("html")).toHaveAttribute("data-theme", mode);
      expect(await exported.evaluate(() => matchMedia("(prefers-color-scheme: dark)").matches)).toBe(mode === "light");
      await expect(content.getByRole("heading", { name: "Earlier audit" })).toBeVisible();
      await expect(content.locator("#scheme")).toHaveText(mode);
      await expect(content.locator("#scheme")).toHaveCSS("font-weight", mode === "dark" ? "700" : "400");
      await expect(content.locator("#isolation")).toHaveText("isolated");
      expect(await content.locator("body").evaluate(() => document.compatMode)).toBe("CSS1Compat");
      await expect(content.locator("body")).toHaveCSS("background-color", background);
      await content.getByRole("button", { name: "Complete task", exact: true }).click();
      await expect(content.getByRole("button", { name: "Complete", exact: true })).toBeVisible();
    } finally {
      await offline.close();
    }
    expect(await execute("revisions", { url: first.url })).toHaveLength(2);
  } finally {
    await request.delete(`${uiOrigin}/v1/projects/${project.id}`);
    rmSync(repo, { recursive: true, force: true });
  }
});
