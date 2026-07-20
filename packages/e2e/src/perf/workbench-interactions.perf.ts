import { expect, test } from "@playwright/test";
import { calculateStats, installLongTaskObserver, throttleChromiumCpu } from "./perf-helpers";

const apiPort = Number(process.env.E2E_API_PORT ?? "3300");
const apiBase = `http://localhost:${apiPort}`;

declare global {
  interface Window {
    __ps165InteractionStarts?: Record<string, number>;
  }
}

interface InteractionResult {
  name: "resize" | "close" | "reopen";
  duration: number;
  longTasks: number[];
}

const samples: Record<InteractionResult["name"], number[]> = { resize: [], close: [], reopen: [] };

const deleteAllProjects = async (request: import("@playwright/test").APIRequestContext) => {
  const response = await request.get(`${apiBase}/v1/projects`);
  expect(response.ok()).toBe(true);
  for (const project of (await response.json()) as Array<{ id: string }>) {
    expect((await request.delete(`${apiBase}/v1/projects/${project.id}`)).ok()).toBe(true);
  }
};

const createProject = async (request: import("@playwright/test").APIRequestContext) => {
  const response = await request.post(`${apiBase}/v1/projects`, { data: { name: "PS-165 Performance" } });
  expect(response.ok()).toBe(true);
  return (await response.json()) as { id: string };
};

const preparePage = async (page: import("@playwright/test").Page, projectId: string) => {
  await page.addInitScript((currentProjectId: string) => {
    localStorage.setItem("onboarding-complete", "true");
    localStorage.setItem("selected-agent", "pstdio.extension-lab.fake");
    localStorage.setItem("dashboard-wb:selected-project:global", currentProjectId);
    localStorage.setItem(
      `pstdio-project-settings/projects/${currentProjectId}/values`,
      JSON.stringify({ state: { sessionModalState: "closed", selectedSessionId: null }, version: 0 }),
    );
    window.__ps165InteractionStarts = {};
    const recordStart = (event: Event) => {
      const element = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-ps165-action]") : null;
      const action = element?.dataset.ps165Action;
      if (action) window.__ps165InteractionStarts![action] = performance.now();
    };
    document.addEventListener("keydown", recordStart, true);
    document.addEventListener("click", recordStart, true);
  }, projectId);
  await installLongTaskObserver(page);
  await throttleChromiumCpu(page);
};

const afterTwoFrames = (page: import("@playwright/test").Page) =>
  page.evaluate(
    () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
  );

const measure = async (
  page: import("@playwright/test").Page,
  name: InteractionResult["name"],
  interact: () => Promise<void>,
  ready: () => Promise<void>,
) => {
  await page.evaluate((action) => {
    window.__longTasks = [];
    delete window.__ps165InteractionStarts?.[action];
  }, name);
  await interact();
  await ready();
  await afterTwoFrames(page);

  const result = await page.evaluate((action): InteractionResult => {
    const start = window.__ps165InteractionStarts?.[action];
    if (start === undefined) throw new Error(`No input event captured for ${action}`);
    return {
      name: action as InteractionResult["name"],
      duration: performance.now() - start,
      longTasks: (window.__longTasks ?? []).map((entry) => entry.duration),
    };
  }, name);
  samples[name].push(result.duration);
  expect(result.longTasks).toEqual([]);
  return result;
};

test.describe("PS-165 workbench interactions", () => {
  test.afterAll(() => {
    for (const [name, values] of Object.entries(samples)) {
      const stats = calculateStats(values);
      console.info(JSON.stringify({ ticket: "PS-165", interaction: name, samples: values, stats }));
      expect(stats.p95).toBeLessThanOrEqual(150);
    }
  });

  test("resizes, closes, and reopens within the interaction budget", async ({ page, request }, testInfo) => {
    await deleteAllProjects(request);
    const project = await createProject(request);
    await preparePage(page, project.id);

    await page.goto(`/projects/${project.id}`);
    await page.getByRole("option", { name: "Open terminal", exact: true }).click();
    const separator = page.getByRole("separator", { name: "Resize Secondary Panel" });
    await expect(separator).toBeVisible();
    await expect(page.locator(".xterm").first()).toBeVisible();
    await afterTwoFrames(page);

    const initialSize = Number(await separator.getAttribute("aria-valuenow"));
    await separator.evaluate((element) => {
      element.dataset.ps165Action = "resize";
    });
    const resize = await measure(
      page,
      "resize",
      () => separator.press("ArrowUp"),
      () => expect(separator).toHaveAttribute("aria-valuenow", String(initialSize + 24)),
    );

    await separator.evaluate((element) => {
      element.dataset.ps165Action = "close";
    });
    const showPanelButton = page.getByRole("button", { name: "Show terminal panel" });
    const close = await measure(
      page,
      "close",
      () => separator.press("Home"),
      () => expect(showPanelButton).toBeVisible(),
    );

    await showPanelButton.evaluate((element) => {
      element.dataset.ps165Action = "reopen";
    });
    const reopen = await measure(
      page,
      "reopen",
      () => showPanelButton.click(),
      () => expect(separator).toBeVisible(),
    );

    console.info(JSON.stringify({ ticket: "PS-165", repeat: testInfo.repeatEachIndex, resize, close, reopen }));
  });
});
