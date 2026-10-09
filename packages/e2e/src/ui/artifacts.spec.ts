import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { expect, test } from "@playwright/test";
import { folderProjectInput } from "../helpers/folder-project";
import { uiOrigin } from "../ui-server";
import { startStorybook, stopStorybook, storyUrl } from "./mermaid-renderer-storybook";

const extensionId = "pstdio.pstdio-artifacts";

// Let iframe color-scheme follow its embedding element instead of browser media emulation.
test.use({ colorScheme: null });

test("loads a thumbnail while command completion refreshes host props", async ({ page }) => {
  const storyId = "extensions-artifacts-library--host-updates";
  const { baseUrl, storybook } = await startStorybook(storyId, "pstdio-dashboard");
  try {
    await page.goto(storyUrl(baseUrl, storyId));
    const card = page.getByRole("button", { name: "Release overview", exact: true });
    await card.scrollIntoViewIfNeeded();
    await expect(card.frameLocator("iframe").frameLocator("iframe").locator("h1")).toHaveText("Saved preview");
  } finally {
    await stopStorybook(storybook);
  }
});

test("starts and opens creation sessions from both artifact examples", async ({ page, request }) => {
  const repoRoot = resolve(import.meta.dirname, "../../../..");
  const tempRoot = resolve(repoRoot, "__test-tmp__");
  mkdirSync(tempRoot, { recursive: true });
  const repo = mkdtempSync(join(tempRoot, "artifact-creation-"));
  execFileSync("git", ["init", "--quiet", repo]);
  const created = await request.post(`${uiOrigin}/v1/projects`, {
    data: folderProjectInput({ name: "Artifact creation examples" }, repo),
  });
  expect(created.ok()).toBe(true);
  const project = (await created.json()) as { id: string };
  try {
    const enabled = await request.post(
      `${uiOrigin}/v1/projects/${project.id}/extensions/installed/workbench-fixture/enable`,
      {
        data: {
          displayName: "Workbench fixture",
          extensionId: "pstdio.workbench-fixture",
          manifest: { id: "pstdio.workbench-fixture", name: "workbench-fixture" },
          name: "workbench-fixture",
          sourceHash: "artifact-creation",
          sourceKind: "local_path",
          sourcePath: resolve(repoRoot, "packages/workbench-fixture"),
          sourceRef: null,
          version: null,
        },
      },
    );
    expect(enabled.ok()).toBe(true);
    const configured = await request.patch(`${uiOrigin}/v1/projects/${project.id}`, {
      data: { default_agent_id: "pstdio.workbench-fixture.harness.fake", default_agent_model: null },
    });
    expect(configured.ok()).toBe(true);
    await page.addInitScript(() => {
      localStorage.setItem("onboarding-complete", "true");
    });
    const libraryUrl = `/projects/${project.id}/extensions/${extensionId}/artifacts`;
    for (const title of ["Project brief", "Project dashboard"]) {
      await page.goto(libraryUrl);
      const frame = page.frameLocator('iframe[title="Artifacts"]:visible').last();
      const response = page.waitForResponse(
        (response) =>
          response.url().endsWith(`${extensionId}.command.startCreation/execute`) &&
          response.request().method() === "POST",
      );
      await frame.getByRole("button", { name: title, exact: true }).click();
      const result = await (await response).json();
      expect(result.outcome.status, result.outcome.reason).toBe("success");
      const target = result.outcome.navigationRequests[0];
      expect(target.resource.id).toBe(result.outcome.value.sessionId);
      await expect(page.getByRole("tab", { name: target.resource.label, exact: true })).toBeVisible();
      const session = await request.get(`${uiOrigin}/v1/sessions/${result.outcome.value.sessionId}`);
      expect(session.ok()).toBe(true);
      expect((await session.json()).project_id).toBe(project.id);
    }
  } finally {
    await request.delete(`${uiOrigin}/v1/projects/${project.id}`);
    rmSync(repo, { recursive: true, force: true });
  }
});

test("publishes HTML, isolates its preview, and preserves revisions across live updates", async ({ page, request }) => {
  // A shared path also lets this test target the isolated Docker instance.
  const tempRoot = resolve(import.meta.dirname, "../../../../__test-tmp__");
  mkdirSync(tempRoot, { recursive: true });
  const repo = mkdtempSync(join(tempRoot, "artifacts-e2e-"));
  execFileSync("git", ["init", "--quiet", repo]);
  const created = await request.post(`${uiOrigin}/v1/projects`, {
    data: folderProjectInput({ name: "Artifacts browser test" }, repo),
  });
  expect(created.ok()).toBe(true);
  const project = (await created.json()) as { id: string };
  const execute = async (command: string, params: Record<string, unknown>) => {
    const response = await request.post(
      `${uiOrigin}/v1/projects/${project.id}/extensions/commands/${extensionId}.command.${command}/execute`,
      { data: { params, source: "api" } },
    );
    expect(response.ok()).toBe(true);
    const body = await response.json();
    expect(body.outcome.status, body.outcome.reason).toBe("success");
    return body.outcome.value;
  };
  try {
    expect(await execute("list", {})).toEqual([]);
    await page.addInitScript((projectId) => {
      if (window !== window.top) return;
      localStorage.setItem("onboarding-complete", "true");
      localStorage.setItem("dashboard-wb2:selected-project:global", projectId);
    }, project.id);
    const libraryUrl = `/projects/${project.id}/extensions/${extensionId}/artifacts`;
    await page.goto(libraryUrl);
    const frame = page.frameLocator('iframe[title="Artifacts"]:visible').last();
    const artifactMenu = frame.getByRole("button", { name: "Artifact actions", exact: true });
    const versionMenu = frame.getByRole("button", { name: "Versions", exact: true });
    await expect(frame.getByText("Your first artifact starts with an idea", { exact: true })).toBeVisible();
    const libraryTab = page.getByRole("tab", { name: "Artifacts", exact: true });
    writeFileSync(
      join(repo, "page.html"),
      `<title>First page</title><h1>First page</h1><button onclick="this.textContent='Complete'">Complete task</button><p id="isolation"></p><p id="network"></p><script>
      try { parent.document.body; document.querySelector('#isolation').textContent='Parent exposed'; } catch { document.querySelector('#isolation').textContent='Parent isolated'; }
      fetch('https://example.com/artifact-probe').then(()=>document.querySelector('#network').textContent='Network exposed').catch(()=>document.querySelector('#network').textContent='Network blocked');
      </script>`,
    );
    const first = await execute("publish", { file_path: "page.html", label: "First" });
    writeFileSync(join(repo, "reference.html"), "<title>Reference</title><h1>Reference chart</h1>");
    const reference = await execute("publish", { file_path: "reference.html" });

    await frame.getByRole("button", { name: "First page", exact: true }).click();
    await expect(artifactMenu).toBeVisible();
    await expect(libraryTab).toHaveAttribute("aria-selected", "false");
    const preview = frame.frameLocator('iframe[title^="Preview: "]').frameLocator("iframe");
    await expect(preview.getByRole("heading", { name: "First page" })).toBeVisible();
    await expect(preview.getByText("Parent isolated")).toBeVisible();
    await expect(preview.getByText("Network blocked")).toBeVisible();
    await preview.getByRole("button", { name: "Complete task" }).click();
    const breadcrumbs = page.getByRole("navigation", { name: "Breadcrumb" });
    await expect(breadcrumbs.getByText("First page", { exact: true })).toBeVisible();
    await breadcrumbs.getByRole("button", { name: "Artifacts", exact: true }).click();
    await expect(libraryTab).toHaveAttribute("aria-selected", "true");
    await expect(breadcrumbs.getByText("First page", { exact: true })).toHaveCount(0);

    await frame.getByRole("button", { name: "Reference", exact: true }).click();
    await expect(preview.getByRole("heading", { name: "Reference chart" })).toBeVisible();
    const referenceTab = page.getByRole("tab", { name: "Reference", exact: true });
    await expect(referenceTab).toHaveAttribute("aria-selected", "true");
    await expect(breadcrumbs.getByText("Reference", { exact: true })).toBeVisible();
    await page.getByRole("tab", { name: "First page", exact: true }).click();
    await expect(preview.getByRole("button", { name: "Complete", exact: true })).toBeVisible();
    await expect(breadcrumbs.getByText("First page", { exact: true })).toBeVisible();
    await page.evaluate(() => {
      const root = document.documentElement;
      root.classList.replace("light", "dark");
      root.setAttribute("data-theme", "dark");
      root.setAttribute("data-color-mode", "dark");
      root.style.colorScheme = "dark";
      root.style.setProperty("--chakra-colors-bg", "#101820");
    });
    await expect(preview.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(preview.locator("body")).toHaveCSS("background-color", "rgb(16, 24, 32)");
    await expect(preview.getByRole("button", { name: "Complete", exact: true })).toBeVisible();
    await expect
      .poll(() => preview.locator("body").evaluate(() => matchMedia("(prefers-color-scheme: dark)").matches))
      .toBe(true);
    await page.evaluate(() => {
      const root = document.documentElement;
      root.classList.replace("dark", "light");
      root.setAttribute("data-theme", "light");
      root.setAttribute("data-color-mode", "light");
      root.style.colorScheme = "light";
      root.style.removeProperty("--chakra-colors-bg");
    });
    await expect(preview.locator("html")).toHaveAttribute("data-theme", "light");
    await expect(preview.getByRole("button", { name: "Complete", exact: true })).toBeVisible();
    const url = new URL(page.url());
    expect(url.pathname + url.search).toBe(libraryUrl);
    writeFileSync(join(repo, "update.html"), "<title>Second page</title><h1>Second page</h1>");
    const second = await execute("publish", { file_path: "update.html", url: first.url, label: "Second" });
    expect(second.url).toBe(first.url);
    rmSync(join(repo, "update.html"));
    await expect(frame.locator('iframe[title^="Preview: "]')).toHaveAttribute("title", "Preview: Second page");
    await expect(preview.getByRole("button", { name: "Complete", exact: true })).toBeVisible();
    await versionMenu.click();
    await frame.getByRole("menuitemradio", { name: "Second · Latest", exact: true }).click();
    await expect(preview.getByRole("heading", { name: "Second page" })).toBeVisible();
    await versionMenu.click();
    await frame.getByRole("menuitemradio", { name: "First", exact: true }).click();
    await expect(preview.getByRole("heading", { name: "First page" })).toBeVisible();
    await page.reload();
    await expect(preview.getByRole("heading", { name: "Second page" })).toBeVisible();
    // A published URL opens the same artifact tab from a fresh page location.
    await page.goto(first.url);
    await expect(preview.getByRole("heading", { name: "Second page" })).toBeVisible();
    const selectedTitle = await page.getByRole("tab", { name: /^(First|Second) page$/ }).innerText();
    await expect(breadcrumbs.getByText(selectedTitle, { exact: true })).toBeVisible();
    await expect(referenceTab).toBeVisible();
    expect(await execute("revisions", { url: first.url })).toHaveLength(2);
    await artifactMenu.click();
    await frame.getByRole("menuitem", { name: "Rename artifact…", exact: true }).click();
    await frame.getByRole("textbox", { name: "Artifact name" }).fill("Launch notes");
    await frame.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByRole("tab", { name: "Launch notes", exact: true })).toBeVisible();
    await artifactMenu.click();
    await frame.getByRole("menuitem", { name: "All artifacts", exact: true }).click();
    const card = frame.getByRole("button", { name: "Launch notes", exact: true });
    await expect(card).toBeVisible();
    // Thumbnails load only after their card enters the viewport.
    await card.scrollIntoViewIfNeeded();
    // The preview is inert; the card itself is the keyboard and pointer target.
    await expect(card.locator("iframe")).toHaveCount(1);
    await card.focus();
    await card.press("Enter");
    await expect(preview.getByRole("heading", { name: "Second page" })).toBeVisible();
    await artifactMenu.click();
    await frame.getByRole("menuitem", { name: "Delete artifact…", exact: true }).click();
    await frame.getByRole("button", { name: "Delete artifact", exact: true }).click();
    await expect(frame.getByRole("button", { name: "Reference", exact: true })).toBeVisible();
    expect((await execute("list", {})).map((item: { url: string }) => item.url)).toEqual([reference.url]);
    await referenceTab.click();
    await artifactMenu.click();
    await frame.getByRole("menuitem", { name: "Delete artifact…", exact: true }).click();
    await frame.getByRole("button", { name: "Delete artifact", exact: true }).click();
    await expect(frame.getByText("Your first artifact starts with an idea", { exact: true })).toBeVisible();
    expect(await execute("list", {})).toEqual([]);
  } finally {
    await request.delete(`${uiOrigin}/v1/projects/${project.id}`).catch(() => {});
    rmSync(repo, { recursive: true, force: true });
  }
});

test("uses translated version and action menus and dialogs", async ({ page }) => {
  const storyId = "extensions-artifacts-library--french";
  const { baseUrl, storybook } = await startStorybook(storyId, "pstdio-dashboard");
  try {
    await page.goto(storyUrl(baseUrl, storyId));
    await expect(page.getByRole("button", { name: "Release overview", exact: true })).toBeVisible();
    await page.goto(storyUrl(baseUrl, "extensions-artifacts-reader--french"));
    const versions = page.getByRole("button", { name: "Versions", exact: true });
    const actions = page.getByRole("button", { name: "Actions de l’artefact", exact: true });
    await versions.click();
    await expect(page.getByRole("menuitemradio", { name: "Version 1 · Dernière version" })).toBeVisible();
    await page.keyboard.press("Escape");
    await actions.click();
    await page.getByRole("menuitem", { name: "Renommer l’artefact…" }).click();
    await expect(page.getByRole("textbox", { name: "Nom de l’artefact" })).toHaveValue("Release overview");
    await page.getByRole("button", { name: "Annuler", exact: true }).click();
    await actions.click();
    await page.getByRole("menuitem", { name: "Supprimer l’artefact…" }).click();
    await expect(page.getByRole("button", { name: "Supprimer l’artefact", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Fermer", exact: true })).toHaveCount(2);
  } finally {
    await stopStorybook(storybook);
  }
});
