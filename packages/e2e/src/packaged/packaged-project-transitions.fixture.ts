import { mkdirSync, mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { CDPSession, Page, TestInfo } from "@playwright/test";
import { rendererBudgets } from "pstdio-benchmarks";
import { e2eExtensions } from "../default-extensions";
import { observeEventConnectionBudget } from "../helpers/event-connection-budget";
import { folderProjectInput } from "../helpers/folder-project";
import { sampleDesktopMemory } from "../perf/desktop-memory-samples";
import { type Browser, expect } from "../scripts/playwright-test";
import { PACKAGED_DASHBOARD_BROWSER } from "./packaged-chromium";
import { PACKAGED_BINARY_PATH } from "./packaged-helpers";
import { marmaladeCommand, marmaladeFrames, openMarmalade } from "./packaged-marmalade.fixture";
import { runtimeAuthorization, signInBrowser, startPackagedServe, stopProcess } from "./packaged-serve-helpers";

const rendererSessions = async (page: Page) => {
  const sessions = new Map<string, CDPSession>();
  for (const target of [page, ...page.frames().filter((frame) => frame.parentFrame())]) {
    const session = await page.context().newCDPSession(target);
    const { targetInfo } = await session.send("Target.getTargetInfo");
    if (sessions.has(targetInfo.targetId)) await session.detach();
    else {
      sessions.set(targetInfo.targetId, session);
      await session.send("Performance.enable");
    }
  }
  return sessions;
};
const metrics = async (session: CDPSession) => {
  const { metrics } = await session.send("Performance.getMetrics");
  return Object.fromEntries(metrics.map((metric) => [metric.name, metric.value]));
};

const recordRetainedMemory = async (
  browser: Browser,
  hostPid: number,
  page: Page,
  root: string,
  testInfo: Pick<TestInfo, "attach">,
  label = "burst",
) => {
  const processes = await browser.newBrowserCDPSession();
  try {
    const info = await processes.send("SystemInfo.getProcessInfo");
    const roots = [hostPid, ...info.processInfo.map((entry) => entry.id)];
    const memory = sampleDesktopMemory(PACKAGED_BINARY_PATH, () => roots, join(root, `${label}-footprint.jsonl`));
    memory.phase("measure");
    let measured: Awaited<ReturnType<typeof memory.close>>;
    try {
      await page.waitForTimeout(2_000);
    } finally {
      try {
        measured = await memory.close();
      } finally {
        await testInfo.attach(`retained-physical-footprint-${label}`, {
          path: join(root, `${label}-footprint.jsonl`),
          contentType: "application/x-ndjson",
        });
      }
    }
    expect(measured.missingSamples).toBe(0);
    expect(measured.maximumGapMs).toBeLessThanOrEqual(1_000);
    return measured;
  } finally {
    await processes.detach();
  }
};

const seedProject = async (root: string, host: Awaited<ReturnType<typeof startPackagedServe>>, index: number) => {
  const folder = join(root, `project-${index}`);
  mkdirSync(folder);
  const response = await fetch(`${host.baseUrl}/v1/projects`, {
    method: "POST",
    headers: { ...runtimeAuthorization(host.descriptor), "content-type": "application/json" },
    body: JSON.stringify(folderProjectInput({ name: `Retained project ${index}` }, folder)),
  });
  expect(response.ok).toBe(true);
  const project = (await response.json()) as { id: string; name: string };
  const state = {
    ...project,
    tool: ["Move", "Hand", "Text", "Brush", "Rectangle", "Ellipse", "Zoom"][index % 7]!,
    zoom: 0.5 + index * 0.05,
    pan: { x: index * 7, y: index * 11 },
  };
  for (const action of [
    { type: "text", id: "title", text: project.name },
    { type: "properties", id: "title", changes: { name: project.name } },
    { type: "tool", tool: state.tool.toLowerCase() },
    { type: "select", ids: ["title"] },
    { type: "viewport", zoom: state.zoom, pan: state.pan },
  ])
    await marmaladeCommand({ host }, project.id, "marmalade.session.execute", { action });
  return state;
};

export const qualifyProjectTransitions = async (
  playwright: Pick<typeof import("@playwright/test"), "chromium">,
  count: number,
  testInfo: Pick<TestInfo, "attach">,
  settledMemory = false,
  signal?: AbortSignal,
) => {
  // Critical: returning to a loaded project must not restart five document reads or display another project's content.
  const root = realpathSync(mkdtempSync(join(tmpdir(), "pstdio-project-transitions-")));
  let host: Awaited<ReturnType<typeof startPackagedServe>> | undefined;
  let browser: Browser | undefined;
  const failures: unknown[] = [];
  const observations: Record<string, unknown> = { projects: count, viewsPerProject: 5 };
  const sessions = new Map<string, CDPSession>();
  try {
    host = await startPackagedServe(
      root,
      {
        PSTDIO_DEFAULT_EXTENSIONS: e2eExtensions("extension-lab", "pstdio-workspaces", "pstdio-home"),
      },
      PACKAGED_BINARY_PATH,
      undefined,
      undefined,
      signal,
    );
    const device = { host };
    const projects: { id: string; name: string; tool: string; zoom: number; pan: { x: number; y: number } }[] = [];
    for (let index = 0; index < count; index++) projects.push(await seedProject(root, host, index));
    browser = await playwright.chromium.launch({ headless: true, ...PACKAGED_DASHBOARD_BROWSER });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    await page.addInitScript(() => {
      if (window === window.top) localStorage.setItem("onboarding-complete", "true");
    });
    const connections = await observeEventConnectionBudget(page);
    const finiteReads: string[] = [];
    const pendingSizes = new Set<Promise<void>>();
    let requests = 0,
      responseBytes = 0;
    page.on("request", (request) => {
      requests++;
      if (request.url().includes("marmalade.session.read/execute")) finiteReads.push(request.url());
    });
    page.on("requestfinished", (request) => {
      const pending = request
        .sizes()
        .then(
          (sizes) => {
            responseBytes += sizes.responseBodySize;
          },
          () => {},
        )
        .finally(() => pendingSizes.delete(pending));
      pendingSizes.add(pending);
    });
    await signInBrowser(page, host.descriptor);
    await openMarmalade(page, device, projects[0]!.id);
    const assertViews = async (project: (typeof projects)[number]) => {
      for (const title of ["Great Wave", "Properties and layers", "Marmalade tools", "Marmalade", "Document status"])
        await expect(page.locator(`iframe[title="${title}"]:visible`)).toBeVisible();
      const views = marmaladeFrames(page);
      await expect(views.canvas.locator("svg text").filter({ hasText: project.name })).toBeVisible();
      await expect(views.rail.getByRole("button", { name: `${project.tool} tool`, exact: true })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      await expect(views.inspector.getByRole("option", { name: project.name, exact: true })).toHaveAttribute(
        "aria-selected",
        "true",
      );
      await expect(views.status.getByText(`${Math.round(project.zoom * 100)}%`, { exact: true })).toBeVisible();
      await expect(views.canvas.locator('svg[aria-label="Marmalade document canvas"] > g')).toHaveAttribute(
        "transform",
        `translate(${project.pan.x} ${project.pan.y}) scale(${project.zoom})`,
      );
      await expect(views.nav.getByText("Great Wave", { exact: true })).toBeVisible();
    };
    await assertViews(projects[0]!);
    const select = async (project: (typeof projects)[number]) => {
      await marmaladeFrames(page).nav.getByRole("button", { name: "Back to project", exact: true }).click();
      await page.getByRole("button", { name: "Switch project", exact: true }).click();
      await page
        .getByRole("dialog", { name: "Projects", exact: true })
        .getByText(project.name, { exact: true })
        .click();
      await expect(page).toHaveURL(new RegExp(`/projects/${project.id}`));
      await page.getByRole("option", { name: "Marmalade", exact: true }).click();
      await assertViews(project);
    };
    for (const project of projects.slice(1)) await select(project);
    expect(finiteReads).toHaveLength(count);
    const baseline = { reads: finiteReads.length, requests, responseBytes };
    const transitions: { projectId: string; elapsedMs: number; requests: number; responseBytes: number }[] = [];
    for (const project of projects) {
      const before = { requests, responseBytes };
      const start = await page.evaluate(() => performance.now());
      await select(project);
      await Promise.all(pendingSizes);
      transitions.push({
        projectId: project.id,
        elapsedMs: await page.evaluate((start) => performance.now() - start, start),
        requests: requests - before.requests,
        responseBytes: responseBytes - before.responseBytes,
      });
    }
    expect(finiteReads).toHaveLength(count);
    expect(await page.locator('iframe[title="Great Wave"]:visible').count()).toBe(1);
    const transport = connections.state();
    expect(transport.protocols.length).toBeGreaterThan(0);
    expect(new Set(transport.protocols)).toEqual(new Set(["http/1.1"]));
    expect(transport.maximum).toBeLessThanOrEqual(2);
    expect(transport.paths.every((path) => path === "/v1/session-stream" || path === "/v1/sync/stream")).toBe(true);
    observations.baseline = baseline;
    observations.warmTransitions = transitions;
    observations.finiteReads = finiteReads.length;
    observations.connections = transport;
    const warmedAt = performance.now();
    if (process.platform === "darwin") {
      observations.retainedPhysicalFootprint = await recordRetainedMemory(
        browser,
        host.child.pid!,
        page,
        root,
        testInfo,
      );
      observations.memoryTopology =
        "Compiled host and headless Chromium process trees; desktop shell measured separately";
    }
    if (count === 10) {
      for (const [id, session] of await rendererSessions(page)) sessions.set(id, session);
      await page.waitForTimeout(2_000);
      const before = new Map(
        await Promise.all([...sessions].map(async ([id, session]) => [id, await metrics(session)] as const)),
      );
      const beforeReads = finiteReads.length;
      await page.waitForTimeout(10_000);
      const idle = await Promise.all(
        [...sessions].map(async ([id, session]) => {
          const after = await metrics(session),
            start = before.get(id)!;
          const seconds = after.Timestamp - start.Timestamp;
          return {
            target: id,
            seconds,
            scriptShare: (after.ScriptDuration - start.ScriptDuration) / seconds,
            taskShare: (after.TaskDuration - start.TaskDuration) / seconds,
            retainedJsHeapBytes: after.JSHeapUsedSize,
            before: start,
            after,
          };
        }),
      );
      observations.idleRenderers = idle;
      expect(finiteReads).toHaveLength(beforeReads);
      for (const measured of idle) {
        expect(measured.scriptShare).toBeLessThan(rendererBudgets.idleScript.value);
        expect(measured.taskShare).toBeLessThan(rendererBudgets.idleTask.value);
      }
    }
    if (settledMemory) {
      // The reference memory procedure settles for 30 seconds. Keep the burst sample too.
      await page.waitForTimeout(Math.max(0, 30_000 - (performance.now() - warmedAt)));
      observations.settledPhysicalFootprint = await recordRetainedMemory(
        browser,
        host.child.pid!,
        page,
        root,
        testInfo,
        "settled",
      );
      observations.memorySettleMs = performance.now() - warmedAt;
    }
  } catch (error) {
    failures.push(error);
  } finally {
    observations.failures = failures.map((error) => (error instanceof Error ? error.stack : String(error)));
    const stopped = await Promise.allSettled([
      testInfo.attach("project-transitions", {
        body: JSON.stringify(observations, null, 2),
        contentType: "application/json",
      }),
      ...[...sessions.values()].map((session) => session.detach()),
    ]);
    for (const result of stopped) if (result.status === "rejected") failures.push(result.reason);
    // CDP sessions belong to the browser, and the browser's pages still use the host.
    // Finish those owners in order so closing a parent cannot invalidate its child cleanup.
    for (const close of [() => browser?.close(), () => (host ? stopProcess(host.child) : undefined)]) {
      try {
        await close();
      } catch (error) {
        failures.push(error);
      }
    }
    try {
      rmSync(root, { recursive: true, force: true });
    } catch (error) {
      failures.push(error);
    }
  }
  if (failures.length)
    throw new AggregateError(failures, "Production project-transition qualification failed", { cause: failures[0] });
};
