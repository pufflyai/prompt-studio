import { rmSync, writeFileSync } from "node:fs";
import { expect, type Page, test } from "@playwright/test";
import { createPlannerAttempt, createPlannerTicket, executePlannerCommand } from "../helpers/planner-api";
import { createGitRepo, registerRepoViaApi } from "../ui/helpers/workspace-session-attempt";
import { calculateStats, installLongTaskObserver, throttleChromiumCpu } from "./perf-helpers";

const apiPort = Number(process.env.E2E_API_PORT ?? "3300");
const apiBase = `http://localhost:${apiPort}`;

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
    __ps183SwitchStart?: number;
    __ps183SwitchSettled?: number;
    __ps183SwitchObserver?: MutationObserver;
    __ps183StableInstances?: {
      main: Element | null;
      nav: Element | null;
      status: Element | null;
    };
  }
}

const deleteAllProjects = async (request: import("@playwright/test").APIRequestContext) => {
  const response = await request.get(`${apiBase}/v1/projects`);
  expect(response.ok()).toBe(true);
  for (const project of (await response.json()) as Array<{ id: string }>) {
    expect((await request.delete(`${apiBase}/v1/projects/${project.id}`)).ok()).toBe(true);
  }
};

const createSession = async (
  request: import("@playwright/test").APIRequestContext,
  projectId: string,
  workspaceId: string,
  title: string,
  status: "in_progress" | "completed",
) => {
  const created = await request.post(`${apiBase}/v1/sessions`, {
    data: {
      agent: "pstdio.extension-lab.fake",
      project_id: projectId,
      prompt: title,
      title,
      workspace_id: workspaceId,
    },
  });
  expect(created.ok()).toBe(true);
  const session = (await created.json()) as { id: string };
  const updated = await request.patch(`${apiBase}/v1/sessions/${session.id}/status`, { data: { status } });
  expect(updated.ok()).toBe(true);
};

const seedProject = async (request: import("@playwright/test").APIRequestContext, name: string, slug: string) => {
  const projectResponse = await request.post(`${apiBase}/v1/projects`, { data: { name } });
  expect(projectResponse.ok()).toBe(true);
  const project = (await projectResponse.json()) as { id: string };
  const repoRoot = createGitRepo(`pstdio-ps-183-${slug}-`, `${name} seed`);
  const repo = await registerRepoViaApi(request, apiBase, project.id, `${slug}-repo`, repoRoot);
  const parent = await createPlannerTicket(request, apiBase, project.id, { content: `${name} parent` });
  const child = await createPlannerTicket(request, apiBase, project.id, { content: `${name} child` });
  await executePlannerCommand(request, apiBase, project.id, "update-ticket", {
    id: child.id,
    parent: parent.shorthand,
  });
  const attempt = await createPlannerAttempt(request, apiBase, project.id, {
    ticketId: child.id,
    repoId: repo.id,
    mode: "worktree",
    startSession: false,
  });
  await createSession(request, project.id, attempt.workspace.id, `${name} active`, "in_progress");
  await createSession(request, project.id, attempt.workspace.id, `${name} completed`, "completed");
  return { id: project.id, name, repoRoot } satisfies ProjectFixture;
};

const waitForProjectExtensions = async (request: import("@playwright/test").APIRequestContext, projectId: string) => {
  await expect
    .poll(
      async () => {
        const response = await request.get(`${apiBase}/v1/projects/${projectId}/extensions/ui`);
        if (!response.ok()) return false;
        const metadata = (await response.json()) as { kanbanRenderers?: Array<{ resourceKind?: string }> };
        return metadata.kanbanRenderers?.some((renderer) => renderer.resourceKind === "ticket") ?? false;
      },
      { timeout: 30_000 },
    )
    .toBe(true);
};

const projectPicker = (page: Page) =>
  page
    .getByRole("dialog")
    .filter({ has: page.getByPlaceholder("Search projects...") })
    .last();

const prepareSwitch = async (page: Page, targetProjectName: string) => {
  await page.evaluate((targetName) => {
    window.__ps183SwitchObserver?.disconnect();
    window.__longTasks = [];
    delete window.__ps183SwitchStart;
    delete window.__ps183SwitchSettled;
    window.__ps183StableInstances = {
      main: document.querySelector('[data-workbench-panel="main"]'),
      nav: document.querySelector('[data-workbench-region="nav"]'),
      status: document.querySelector('[data-workbench-region="status"]'),
    };

    const ready = () => {
      const header = document.querySelector('[data-workbench-region="nav"]');
      const sidenav = document.querySelector('[data-workbench-region="sidenav"]');
      return header?.textContent?.includes(targetName) && sidenav?.textContent?.includes("Tickets");
    };

    window.__ps183SwitchObserver = new MutationObserver(() => {
      if (!ready() || window.__ps183SwitchSettled !== undefined) return;
      window.__ps183SwitchObserver?.disconnect();
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          window.__ps183SwitchSettled = performance.now();
        });
      });
    });
    window.__ps183SwitchObserver.observe(document.body, { attributes: true, childList: true, subtree: true });
  }, targetProjectName);
};

const readSwitch = async (
  page: Page,
  cycle: number,
  direction: ProjectSwitchSample["direction"],
  requests: string[],
) => {
  await page.waitForFunction(() => window.__ps183SwitchSettled !== undefined);
  return page.evaluate(
    ({ cycle, direction, requests }) => {
      const start = window.__ps183SwitchStart;
      const settled = window.__ps183SwitchSettled;
      if (start === undefined || settled === undefined) throw new Error("Project switch timing was not captured");
      const stable = window.__ps183StableInstances;
      return {
        cycle,
        direction,
        duration: settled - start,
        longTasks: (window.__longTasks ?? [])
          .filter((task) => task.startTime >= start && task.startTime < settled)
          .map((task) => task.duration),
        requests,
        stableInstances: {
          main: stable?.main === document.querySelector('[data-workbench-panel="main"]'),
          nav: stable?.nav === document.querySelector('[data-workbench-region="nav"]'),
          status: stable?.status === document.querySelector('[data-workbench-region="status"]'),
        },
      };
    },
    { cycle, direction, requests: [...requests] },
  );
};

test("PS-183 switches projects once and within budget", async ({ page, request }) => {
  test.setTimeout(240_000);
  await deleteAllProjects(request);
  const projectA = await seedProject(request, "PS-183 A", "a");
  const projectB = await seedProject(request, "PS-183 B", "b");
  const requests: string[] = [];
  page.on("request", (entry) => requests.push(new URL(entry.url()).pathname));

  try {
    await waitForProjectExtensions(request, projectA.id);
    await waitForProjectExtensions(request, projectB.id);
    await page.addInitScript((projectId) => {
      localStorage.setItem("onboarding-complete", "true");
      localStorage.setItem("selected-agent", "pstdio.extension-lab.fake");
      localStorage.setItem("dashboard-wb:selected-project:global", projectId);
      document.addEventListener(
        "click",
        (event) => {
          if (!(event.target instanceof Element) || !event.target.closest("[data-ps183-project-switch]")) return;
          window.__ps183SwitchStart = performance.now();
        },
        true,
      );
    }, projectA.id);
    await installLongTaskObserver(page);
    await throttleChromiumCpu(page);
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
      await targetRow.evaluate((element) => {
        element.dataset.ps183ProjectSwitch = "";
      });
      await prepareSwitch(page, target.name);
      requests.length = 0;
      await targetRow.click();
      const result = await readSwitch(page, cycle, direction, requests);
      samples.push(result);
      console.info(JSON.stringify({ ticket: "PS-183", ...result }));
    };

    for (let cycle = 0; cycle < 10; cycle += 1) {
      await switchProject(projectB, cycle, "a-to-b");
      await switchProject(projectA, cycle, "b-to-a");
    }

    const aToB = samples.filter((sample) => sample.direction === "a-to-b").map((sample) => sample.duration);
    const bToA = samples.filter((sample) => sample.direction === "b-to-a").map((sample) => sample.duration);
    const summary = {
      ticket: "PS-183",
      samples,
      stats: {
        aToB: calculateStats(aToB),
        bToA: calculateStats(bToA),
      },
    };
    console.info(JSON.stringify(summary));
    if (process.env.PS183_OUTPUT_PATH) {
      writeFileSync(process.env.PS183_OUTPUT_PATH, `${JSON.stringify(summary, null, 2)}\n`);
    }
    expect(aToB).toHaveLength(10);
    expect(bToA).toHaveLength(10);
    expect(samples.filter((sample) => sample.longTasks.length > 0)).toEqual([]);
    expect(samples.filter((sample) => !Object.values(sample.stableInstances).every(Boolean))).toEqual([]);
    expect(
      samples.filter((sample) => {
        const targetId = sample.direction === "a-to-b" ? projectB.id : projectA.id;
        return sample.requests.filter((path) => path === `/v1/projects/${targetId}/extensions/ui`).length !== 1;
      }),
    ).toEqual([]);
    expect(
      samples.filter((sample) => {
        const targetId = sample.direction === "a-to-b" ? projectB.id : projectA.id;
        return sample.requests.filter((path) => path === `/v1/projects/${targetId}/extensions/appearance`).length !== 1;
      }),
    ).toEqual([]);
    expect(summary.stats.aToB.p95).toBeLessThanOrEqual(300);
    expect(summary.stats.bToA.p95).toBeLessThanOrEqual(300);
  } finally {
    rmSync(projectA.repoRoot, { recursive: true, force: true });
    rmSync(projectB.repoRoot, { recursive: true, force: true });
  }
});
