import { expect, test } from "@playwright/test";

const apiPort = Number(process.env.E2E_API_PORT ?? "3200");
const apiBase = `http://localhost:${apiPort}`;

const bypassOnboarding = async (page: import("@playwright/test").Page) => {
  await page.addInitScript(() => {
    localStorage.setItem("onboarding-complete", "true");
    localStorage.setItem("selected-agent", "fake");
  });
};

const deleteAllProjects = async (request: import("@playwright/test").APIRequestContext) => {
  const res = await request.get(`${apiBase}/v1/projects`);
  const projects = (await res.json()) as { id: string }[];
  for (const p of projects) {
    await request.delete(`${apiBase}/v1/projects/${p.id}`);
  }
};

const createProjectViaApi = async (request: import("@playwright/test").APIRequestContext, name: string) => {
  const res = await request.post(`${apiBase}/v1/projects`, { data: { name } });
  expect(res.ok()).toBe(true);
  return (await res.json()) as { id: string; name: string };
};

const configureAgent = async (request: import("@playwright/test").APIRequestContext, agentId: string) => {
  const res = await request.post(`${apiBase}/v1/agents`, { data: { agent_id: agentId } });
  expect(res.ok()).toBe(true);
};

test.describe("Command palette keyboard navigation", () => {
  let projectId: string;

  test.beforeEach(async ({ request }) => {
    test.setTimeout(30_000);
    await deleteAllProjects(request);
    await configureAgent(request, "fake");
    const project = await createProjectViaApi(request, "Command Palette Keyboard Project");
    projectId = project.id;
  });

  test("arrow keys move the selection after the pointer enters the list", async ({ page }) => {
    await bypassOnboarding(page);
    await page.goto(`/projects/${projectId}/tickets`);

    // Wait for the workbench shell to boot so the command-palette shortcut is registered.
    await expect(page.getByRole("button", { name: /Command Palette Keyboard Project/ })).toBeVisible();

    await page.keyboard.press("Control+Shift+P");

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    await dialog.getByRole("textbox").fill("> ");

    const rows = dialog.locator("[aria-selected]");
    await expect(rows.first()).toBeVisible();
    await expect.poll(() => rows.count()).toBeGreaterThan(1);

    // Hovering an entry must not hijack keyboard focus away from the input.
    await rows.nth(1).hover();

    const selected = dialog.locator('[aria-selected="true"]');
    const beforeText = ((await selected.textContent()) ?? "").trim();
    expect(beforeText).not.toBe("");

    await page.keyboard.press("ArrowDown");

    await expect(selected).not.toHaveText(beforeText);
  });
});
