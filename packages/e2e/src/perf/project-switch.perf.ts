import { rmSync } from "node:fs";
import { type APIRequestContext, expect, type Page, test } from "@playwright/test";
import { createPlannerAttempt, createPlannerTicket, executePlannerCommand } from "../helpers/planner-api";
import { createProjectViaApi, deleteAllProjects } from "../ui/helpers/session-follow-up";
import { createGitRepo } from "../ui/helpers/workspace-session-attempt";
import { uiOrigin } from "../ui-server";
import {
  PERF_START_ATTRIBUTE,
  preparePerfPage,
  readInteraction,
  reportSamples,
  resetInteraction,
  waitForTicketsView,
} from "./perf-helpers";

interface ProjectFixture {
  id: string;
  name: string;
  repoRoot: string;
}

interface ProjectSwitchSample {
  cycle: number;
  direction: "a-to-b" | "b-to-a";
  duration: number;
  longTasks: number[];
  requests: string[];
  stableInstances: {
    main: boolean;
    nav: boolean;
    status: boolean;
  };
}

declare global {
  interface Window {
    __stableInstances?: {
      main: Element | null;
      nav: Element | null;
      status: Element | null;
    };
  }
}

const createSession = async (
  request: APIRequestContext,
  projectId: string,
  workspaceId: string,
  title: string,
  status: "in_progress" | "completed",
) => {
  const created = await request.post("/v1/sessions", {
    data: {
      agent: "pstdio.workbench-fixture.harness.fake",
      project_id: projectId,
      prompt: title,
      title,
      workspace_id: workspaceId,
    },
  });
  expect(created.ok()).toBe(true);
  const session = (await created.json()) as { id: string };
  const updated = await request.patch(`/v1/sessions/${session.id}/status`, { data: { status } });
  expect(updated.ok()).toBe(true);
};

const seedProject = async (request: APIRequestContext, name: string, slug: string) => {
  const repoRoot = createGitRepo(`pstdio-project-switch-${slug}-`, `${name} seed`);
  const project = await createProjectViaApi(request, name, repoRoot);
  const parent = await createPlannerTicket(request, uiOrigin, project.id, { content: `${name} parent` });
  const child = await createPlannerTicket(request, uiOrigin, project.id, { content: `${name} child` });
  await executePlannerCommand(request, uiOrigin, project.id, "update-ticket", {
    id: child.id,
    parent: parent.shorthand,
  });
  const attempt = await createPlannerAttempt(request, uiOrigin, project.id, { ticketId: child.id });
  await createSession(request, project.id, attempt.workspace.id, `${name} active`, "in_progress");
  await createSession(request, project.id, attempt.workspace.id, `${name} completed`, "completed");
  return { id: project.id, name, repoRoot } satisfies ProjectFixture;
};

const projectPicker = (page: Page) =>
  page
    .getByRole("dialog")
    .filter({ has: page.getByPlaceholder("Search projects...") })
    .last();

const prepareSwitch = (page: Page, targetProjectName: string) =>
  page.evaluate((targetName) => {
    window.__stableInstances = {
      main: document.querySelector('[data-workbench-panel="main"]'),
      nav: document.querySelector('[data-workbench-region="nav"]'),
      status: document.querySelector('[data-workbench-region="status"]'),
    };

    const ready = () => {
      const header = document.querySelector('[data-workbench-region="nav"]');
      const sidenav = document.querySelector('[data-workbench-region="sidenav"]');
      return header?.textContent?.includes(targetName) && sidenav?.textContent?.includes("Tickets");
    };

    const observer = new MutationObserver(() => {
      if (!ready()) return;
      observer.disconnect();
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          window.__perfSettled = performance.now();
        });
      });
    });
    observer.observe(document.body, { attributes: true, childList: true, subtree: true });
  }, targetProjectName);

const stableInstances = (page: Page) =>
  page.evaluate(() => {
    const stable = window.__stableInstances;
    return {
      main: stable?.main === document.querySelector('[data-workbench-panel="main"]'),
      nav: stable?.nav === document.querySelector('[data-workbench-region="nav"]'),
      status: stable?.status === document.querySelector('[data-workbench-region="status"]'),
    };
  });

test("switches projects once and within budget", async ({ page, request }) => {
  test.setTimeout(240_000);
  await deleteAllProjects(request);
  const projectA = await seedProject(request, "Project switch A", "a");
  const projectB = await seedProject(request, "Project switch B", "b");
  const requests: string[] = [];
  page.on("request", (entry) => requests.push(new URL(entry.url()).pathname));

  try {
    await waitForTicketsView(request, projectA.id);
    await waitForTicketsView(request, projectB.id);
    await preparePerfPage(page, projectA.id);
    await page.goto(`/projects/${projectA.id}/tickets`);
    await expect(page.locator('[data-workbench-region="nav"]')).toContainText(projectA.name, {
      timeout: 30_000,
    });
    await expect(
      page.locator('[data-workbench-region="sidenav"]').getByRole("option", { name: "Tickets", exact: true }),
    ).toBeVisible();

    const samples: ProjectSwitchSample[] = [];
    const switchProject = async (
      target: ProjectFixture,
      cycle: number,
      direction: ProjectSwitchSample["direction"],
    ) => {
      await page.getByRole("button", { name: "Switch project" }).click();
      const picker = projectPicker(page);
      await expect(picker).toBeVisible();
      const targetRow = picker.getByText(target.name, { exact: true });
      await targetRow.evaluate(
        (element, startAttribute) => element.setAttribute(startAttribute, ""),
        PERF_START_ATTRIBUTE,
      );
      await resetInteraction(page);
      await prepareSwitch(page, target.name);
      requests.length = 0;
      await targetRow.click();
      const result = await readInteraction(page);
      samples.push({
        cycle,
        direction,
        ...result,
        requests: [...requests],
        stableInstances: await stableInstances(page),
      });
    };

    for (let cycle = 0; cycle < 10; cycle += 1) {
      await switchProject(projectB, cycle, "a-to-b");
      await switchProject(projectA, cycle, "b-to-a");
    }

    const aToB = samples.filter((sample) => sample.direction === "a-to-b").map((sample) => sample.duration);
    const bToA = samples.filter((sample) => sample.direction === "b-to-a").map((sample) => sample.duration);
    expect(aToB).toHaveLength(10);
    expect(bToA).toHaveLength(10);
    // Measured up to 479 ms with 65-96 ms long tasks on 2026-10-10; the approved budgets sit about 20% above that.
    expect(samples.filter((sample) => Math.max(0, ...sample.longTasks) > 125)).toEqual([]);
    expect(samples.filter((sample) => !Object.values(sample.stableInstances).every(Boolean))).toEqual([]);
    const requestCount = (sample: ProjectSwitchSample, path: string) => {
      const targetId = sample.direction === "a-to-b" ? projectB.id : projectA.id;
      return sample.requests.filter((request) => request === `/v1/projects/${targetId}/extensions/${path}`).length;
    };
    expect(samples.filter((sample) => requestCount(sample, "ui") !== 1)).toEqual([]);
    expect(samples.filter((sample) => requestCount(sample, "appearance") !== 1)).toEqual([]);
    expect(reportSamples("project-switch", "a-to-b", aToB).max).toBeLessThanOrEqual(575);
    expect(reportSamples("project-switch", "b-to-a", bToA).max).toBeLessThanOrEqual(575);
  } finally {
    rmSync(projectA.repoRoot, { recursive: true, force: true });
    rmSync(projectB.repoRoot, { recursive: true, force: true });
  }
});
