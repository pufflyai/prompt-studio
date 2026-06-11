import { expect, test } from "@playwright/test";

const apiPort = Number(process.env.E2E_API_PORT ?? "3200");
const apiBase = `http://localhost:${apiPort}`;

const bypassOnboarding = async (
  page: import("@playwright/test").Page,
  projectId: string,
  agentId = "pstdio.harness-open-code.opencode",
) => {
  await page.addInitScript(
    ({ currentProjectId, currentAgentId }: { currentProjectId: string; currentAgentId: string }) => {
      localStorage.setItem("onboarding-complete", "true");
      localStorage.setItem("selected-agent", currentAgentId);
      localStorage.setItem(
        `pstdio-project-settings/projects/${currentProjectId}/values`,
        JSON.stringify({
          state: {
            lastSelectedAgent: currentAgentId,
            lastSelectedModels: [],
            lastSelectedRepo: "",
            lastSelectedBranches: [],
            sessionModalState: "closed",
            selectedSessionId: null,
          },
          version: 0,
        }),
      );
    },
    { currentProjectId: projectId, currentAgentId: agentId },
  );
};

const deleteAllProjects = async (request: import("@playwright/test").APIRequestContext) => {
  const res = await request.get(`${apiBase}/v1/projects`);
  const projects = (await res.json()) as { id: string }[];
  for (const project of projects) {
    await request.delete(`${apiBase}/v1/projects/${project.id}`);
  }
};

const createProjectViaApi = async (request: import("@playwright/test").APIRequestContext, name: string) => {
  const res = await request.post(`${apiBase}/v1/projects`, { data: { name } });
  expect(res.ok()).toBe(true);
  return (await res.json()) as { id: string };
};

const createStatusViaApi = async (
  request: import("@playwright/test").APIRequestContext,
  projectId: string,
  name: string,
) => {
  const res = await request.post(`${apiBase}/v1/projects/${projectId}/statuses`, {
    data: { name, color: "blue" },
  });
  expect(res.ok()).toBe(true);
};

test.describe("Ticket board horizontal scrolling", () => {
  let projectId: string;

  test.beforeEach(async ({ request }) => {
    await deleteAllProjects(request);
    const project = await createProjectViaApi(request, "Ticket Board Scroll Test");
    projectId = project.id;

    for (const suffix of ["one", "two", "three", "four"]) {
      await createStatusViaApi(request, projectId, `scroll-${suffix}`);
    }
  });

  test("keeps the board horizontally scrollable inside the ticket panel", async ({ page }) => {
    await page.setViewportSize({ width: 1000, height: 900 });
    await bypassOnboarding(page, projectId);

    await page.goto(`/projects/${projectId}/tickets`);
    await expect(page.locator('[data-testid^="board-column-"]').first()).toBeVisible();

    const metrics = await page
      .locator('[data-testid^="board-column-"]')
      .first()
      .evaluate((column) => {
        let element = column.parentElement;

        while (element) {
          if (
            element.getAttribute("data-scope") === "scroll-area" &&
            element.getAttribute("data-part") === "viewport"
          ) {
            const before = element.scrollLeft;
            element.scrollLeft = 240;

            return {
              clientWidth: element.clientWidth,
              scrollWidth: element.scrollWidth,
              before,
              after: element.scrollLeft,
            };
          }

          element = element.parentElement;
        }

        throw new Error("Board viewport not found");
      });

    expect(metrics.scrollWidth).toBeGreaterThan(metrics.clientWidth);
    expect(metrics.after).toBeGreaterThan(metrics.before);
  });
});
