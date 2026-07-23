import { appendFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, type Locator, type Page, test } from "@playwright/test";
import { createGitRepo, registerRepoViaApi } from "../ui/helpers/workspace-session-attempt";
import { calculateStats, installLongTaskObserver, throttleChromiumCpu } from "./perf-helpers";

const apiPort = Number(process.env.E2E_API_PORT ?? "3300");
const apiBase = `http://localhost:${apiPort}`;
const runId = process.env.E2E_RUN_ID ?? `ps-172-${Date.now()}-${process.pid}`;
const samplePath = join(tmpdir(), `pstdio-ps-172-${runId}.jsonl`);
const childKinds = ["files", "diff", "sessions"] as const;

type ChildKind = (typeof childKinds)[number];

interface Workspace {
  id: string;
  workspace_shorthand: string;
}

interface NavigationResult {
  child: ChildKind;
  duration: number;
  longTasks: number[];
}

declare global {
  interface Window {
    __ps172NavigationStart?: number;
    __ps172NavigationSettled?: number;
    __ps172ReadyObserver?: MutationObserver;
  }
}

const createProject = async (request: import("@playwright/test").APIRequestContext) => {
  const response = await request.post(`${apiBase}/v1/projects`, { data: { name: "PS-172 Performance" } });
  expect(response.ok()).toBe(true);
  return (await response.json()) as { id: string };
};

const createWorkspace = async (
  request: import("@playwright/test").APIRequestContext,
  projectId: string,
  repoId: string,
) => {
  const response = await request.post(`${apiBase}/v1/workspaces`, {
    data: { project_id: projectId, repo_id: repoId },
  });
  expect(response.ok()).toBe(true);
  return (await response.json()) as Workspace;
};

const createSession = async (
  request: import("@playwright/test").APIRequestContext,
  projectId: string,
  workspaceId: string,
) => {
  const response = await request.post(`${apiBase}/v1/sessions`, {
    data: {
      project_id: projectId,
      workspace_id: workspaceId,
      title: "PS-172 performance session",
      prompt: "Measure workspace hierarchy navigation",
      agent: "pstdio.extension-lab.fake",
    },
  });
  expect(response.ok()).toBe(true);
};

const childRow = (sidenav: Locator, child: ChildKind) => {
  if (child === "files") return sidenav.getByRole("option", { name: "Files", exact: true });
  if (child === "diff") return sidenav.getByRole("option", { name: /^Diff(?: · \d+ changed)?$/ });
  return sidenav.getByRole("option", { name: "Sessions · 1", exact: true });
};

const expectChildReady = async (page: Page, child: ChildKind) => {
  const breadcrumb = page.getByRole("navigation", { name: "breadcrumb" });
  if (child === "files") {
    await expect(breadcrumb.getByText("Files", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("list", { name: "Workspace files" }).or(page.getByRole("heading", { name: "No workspace files" })),
    ).toBeVisible();
    return;
  }
  if (child === "diff") {
    await expect(breadcrumb.getByText(/^Diff(?: · \d+ changed)?$/, { exact: true })).toBeVisible();
    await expect(page.getByTestId("diff-viewer")).toBeVisible();
    return;
  }
  await expect(breadcrumb.getByText("Sessions · 1", { exact: true })).toBeVisible();
  await expect(page.getByRole("list", { name: "Workspace sessions" })).toBeVisible();
};

const observeChildReady = async (page: Page, child: ChildKind) => {
  await page.evaluate((expectedChild) => {
    window.__ps172ReadyObserver?.disconnect();
    delete window.__ps172NavigationStart;
    delete window.__ps172NavigationSettled;
    window.__longTasks = [];

    const breadcrumb = document.querySelector<HTMLElement>('nav[aria-label="breadcrumb"]');
    const main = document.querySelector<HTMLElement>('[data-workbench-region="main"]');
    if (!breadcrumb || !main) throw new Error("Workspace navigation surfaces are not mounted");

    const isReady = () => {
      const breadcrumbByChild = { files: "Files", diff: "Diff", sessions: "Sessions · 1" };
      const contentByChild = {
        diff: '[data-testid="diff-viewer"]',
        sessions: '[aria-label="Workspace sessions"]',
      };
      const expectedBreadcrumb = breadcrumbByChild[expectedChild];
      const filesReady =
        main.querySelector('[aria-label="Workspace files"]') ||
        [...main.querySelectorAll("h3")].some((heading) => heading.textContent === "No workspace files");
      const contentReady = expectedChild === "files" ? filesReady : main.querySelector(contentByChild[expectedChild]);
      return breadcrumb.textContent?.includes(expectedBreadcrumb) && contentReady;
    };

    window.__ps172ReadyObserver = new MutationObserver(() => {
      if (!isReady() || window.__ps172NavigationSettled !== undefined) return;
      window.__ps172ReadyObserver?.disconnect();
      window.__ps172NavigationSettled = performance.now();
    });
    window.__ps172ReadyObserver.observe(document.body, { attributes: true, childList: true, subtree: true });
  }, child);
};

const readNavigation = async (page: Page, child: ChildKind) => {
  await page.waitForFunction(() => window.__ps172NavigationSettled !== undefined);
  await page.evaluate(
    () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
  );
  return page.evaluate((currentChild): NavigationResult => {
    const start = window.__ps172NavigationStart;
    const settled = window.__ps172NavigationSettled;
    if (start === undefined || settled === undefined) throw new Error("Workspace child timing was not captured");
    return {
      child: currentChild,
      duration: settled - start,
      longTasks: (window.__longTasks ?? [])
        .filter((entry) => entry.startTime >= start && entry.startTime < settled)
        .map((entry) => entry.duration),
    };
  }, child);
};

test("PS-172 navigates workspace children within the interaction budget", async ({ page, request }, testInfo) => {
  test.setTimeout(45_000);
  const expectedRepeatCount = testInfo.project.repeatEach;
  if (testInfo.repeatEachIndex === 0) rmSync(samplePath, { force: true });

  const project = await createProject(request);
  const repoRoot = createGitRepo("pstdio-perf-ps172-", "PS-172 performance fixture");

  try {
    const repo = await registerRepoViaApi(request, apiBase, project.id, "ps-172-perf-repo", repoRoot);
    const workspace = await createWorkspace(request, project.id, repo.id);
    await createSession(request, project.id, workspace.id);
    await page.addInitScript((projectId: string) => {
      localStorage.setItem("onboarding-complete", "true");
      localStorage.setItem("selected-agent", "pstdio.extension-lab.fake");
      localStorage.setItem("dashboard-wb:selected-project:global", projectId);
      document.addEventListener(
        "click",
        (event) => {
          if (event.target instanceof Element && event.target.closest("[data-ps172-child]")) {
            window.__ps172NavigationStart = performance.now();
          }
        },
        true,
      );
    }, project.id);
    await installLongTaskObserver(page);
    await throttleChromiumCpu(page);
    await page.goto("/");

    const sidenav = page.locator('[data-workbench-region="sidenav"]');
    await sidenav
      .getByRole("option", { name: /^Workspaces/ })
      .first()
      .click();
    const workspaceRow = page
      .getByRole("option", { name: new RegExp(`^${workspace.workspace_shorthand}(?:\\s|$)`) })
      .first();
    await expect(workspaceRow).toBeVisible({ timeout: 30_000 });
    await workspaceRow.click();

    for (const child of childKinds) {
      const target = childRow(sidenav, child);
      await expect(target).toBeVisible();
      await target.evaluate((element, kind) => {
        element.dataset.ps172Child = kind;
      }, child);
      await target.click();
      await expectChildReady(page, child);
    }

    for (const child of childKinds) {
      const target = childRow(sidenav, child);
      await observeChildReady(page, child);
      await target.click();
      await expectChildReady(page, child);
      const result = await readNavigation(page, child);
      expect(result.longTasks).toEqual([]);
      appendFileSync(samplePath, `${JSON.stringify(result)}\n`);
      console.info(JSON.stringify({ ticket: "PS-172", repeat: testInfo.repeatEachIndex, ...result }));
    }
  } finally {
    const cleanup = await request.delete(`${apiBase}/v1/projects/${project.id}`);
    expect(cleanup.ok()).toBe(true);
    rmSync(repoRoot, { recursive: true, force: true });
  }

  if (testInfo.repeatEachIndex !== expectedRepeatCount - 1) return;
  const results = readFileSync(samplePath, "utf8")
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line) as NavigationResult);
  rmSync(samplePath, { force: true });
  expect(results).toHaveLength(expectedRepeatCount * childKinds.length);

  for (const child of childKinds) {
    const samples = results.filter((result) => result.child === child).map((result) => result.duration);
    const stats = calculateStats(samples);
    console.info(JSON.stringify({ ticket: "PS-172", interaction: child, samples, stats }));
    expect(stats.p95).toBeLessThanOrEqual(150);
  }
});
