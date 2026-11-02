import { expect, type Page, test } from "@playwright/test";
import { folderProjectInput } from "../helpers/folder-project";
import { homeFrame, homePage } from "../helpers/home-loading";

const emptyMain = (page: Page) => {
  const main = page.locator('[data-workbench-panel="main"]');
  return main
    .getByRole("group", { name: "Available tabs", exact: true })
    .or(main.getByText("No tabs available", { exact: true }));
};

test("Home opens recent conversations and public actions without prematurely creating a session", async ({
  page,
  request,
}) => {
  const response = await request.post("/v1/projects", { data: folderProjectInput({ name: "Home actions" }) });
  expect(response.status()).toBe(201);
  const project = (await response.json()) as { id: string };
  const sessions: { id: string; title: string }[] = [];
  for (let i = 0; i < 7; i++) {
    const created = await request.post("/v1/sessions", {
      data: {
        project_id: project.id,
        title: `Home conversation ${i}`,
        prompt: "",
        agent: "pstdio.workbench-fixture.harness.fake",
      },
    });
    expect(created.status()).toBe(201);
    sessions.push(await created.json());
  }
  await page.goto(`/projects/${project.id}`);
  await expect(homePage(page)).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/projects/${project.id}/extensions/pstdio.pstdio-home/home$`));
  await expect(homeFrame(page).getByRole("button", { name: /^Home conversation/ })).toHaveCount(5);
  await expect(homeFrame(page).getByRole("button", { name: sessions[6].title, exact: true })).toBeVisible();
  await homeFrame(page).getByRole("button", { name: sessions[6].title, exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/projects/${project.id}/session\\?`));
  await page.reload();
  await expect(page.getByRole("navigation", { name: "breadcrumb" })).toContainText(sessions[6].title);
  await page.getByRole("button", { name: "Back to project", exact: true }).click();
  await page.getByRole("option", { name: "Home", exact: true }).click();
  await homeFrame(page).getByRole("link", { name: "New conversation", exact: true }).click();
  await expect(homePage(page)).not.toBeVisible();
  const current = (await (await request.get(`/v1/projects/${project.id}/sessions`)).json()) as { items: unknown[] };
  expect(current.items).toHaveLength(7);
  await page.getByRole("button", { name: "Back to project", exact: true }).click();
  await page.getByRole("option", { name: "Home", exact: true }).click();
  await homeFrame(page).getByRole("link", { name: "Open a tool", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await homeFrame(page).getByRole("link", { name: "Browse extensions", exact: true }).click();
  await expect(page.getByTestId("extensions-panel")).toBeVisible();
});

test("disabling Home exposes the existing empty panel and enabling it restores one page", async ({ page, request }) => {
  const created = await request.post("/v1/projects", { data: folderProjectInput({ name: "Home lifecycle" }) });
  expect(created.status()).toBe(201);
  const project = (await created.json()) as { id: string };
  await page.goto(`/projects/${project.id}`);
  await expect(homePage(page)).toBeVisible();
  const listed = (await (await request.get(`/v1/projects/${project.id}/extensions`)).json()) as {
    extensions: { id: string; installName: string }[];
  };
  const instance = listed.extensions.find((entry) => entry.installName === "pstdio-home")!;
  expect(instance).toBeTruthy();
  const enable = (enabled: boolean) =>
    request.patch(`/v1/projects/${project.id}/extensions/${instance.id}`, { data: { enabled } });
  expect((await enable(false)).ok()).toBe(true);
  await expect(page.getByRole("option", { name: "Home", exact: true })).toHaveCount(0);
  await expect(emptyMain(page)).toBeVisible();
  await page.reload();
  await expect(page.getByRole("option", { name: "Sessions", exact: true })).toBeVisible();
  await expect(page.getByRole("option", { name: "Home", exact: true })).toHaveCount(0);
  await expect(emptyMain(page)).toBeVisible();
  await page.getByRole("option", { name: "Search", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  const reenabled = page.waitForEvent("console", {
    predicate: (message) =>
      message.text().includes('"event":"registration-ready"') && message.text().includes(project.id),
  });
  expect((await enable(true)).ok()).toBe(true);
  await reenabled;
  await page.getByRole("option", { name: "Home", exact: true }).click();
  await expect(homePage(page)).toBeVisible();
  await expect(page.locator('iframe[title="Home"]')).toHaveCount(1);
  await page.getByRole("option", { name: "Sessions", exact: true }).click();
  await page.keyboard.press("Alt+Shift+Space");
  await page.keyboard.press("g");
  await page.keyboard.press("h");
  await expect(homePage(page)).toBeVisible();
});

test("uninstalled Home leaves the project root on the existing empty panel", async ({ page, request }) => {
  const created = await request.post("/v1/projects", { data: folderProjectInput({ name: "Home unavailable" }) });
  expect(created.status()).toBe(201);
  const project = (await created.json()) as { id: string };
  const listed = (await (await request.get(`/v1/projects/${project.id}/extensions`)).json()) as {
    extensions: { id: string; installName: string }[];
  };
  const instance = listed.extensions.find((entry) => entry.installName === "pstdio-home")!;
  expect(instance).toBeTruthy();
  expect((await request.delete(`/v1/projects/${project.id}/extensions/${instance.id}?deleteUserData=true`)).ok()).toBe(
    true,
  );
  await page.goto(`/projects/${project.id}`);
  await expect(page.getByRole("option", { name: "Sessions", exact: true })).toBeVisible();
  await expect(emptyMain(page)).toBeVisible();
  await expect(page.locator('iframe[title="Home"]')).toHaveCount(0);
  await page.getByRole("option", { name: "Sessions", exact: true }).click();
  await page.getByRole("button", { name: "Back to project", exact: true }).click();
  await expect(emptyMain(page)).toBeVisible();
  await expect(page.getByRole("option", { name: "Notes", exact: true })).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/projects/${project.id}$`));
  await page.goto(`/projects/${project.id}/workspaces`);
  await expect(page).toHaveURL(new RegExp(`/projects/${project.id}/workspaces$`));
  await page.getByRole("option", { name: "Sessions", exact: true }).click();
  await page.getByRole("button", { name: "Back to project", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/projects/${project.id}/workspaces$`));
});

test("Home keeps setup and availability recovery feedback beside the action", async ({ page, request }) => {
  const created = await request.post("/v1/projects", { data: folderProjectInput({ name: "Home recovery" }) });
  expect(created.status()).toBe(201);
  const project = (await created.json()) as { id: string };
  let setupBlocked = true;
  let retries = 0;
  // Inject supported service failures at their public HTTP boundary; retry still runs the real setup service.
  await page.route("**/extensions/commands/pstdio.pstdio-home.command.read/execute", async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    if (setupBlocked && body.outcome?.ok) body.outcome.value.setupError = "Setup needs recovery";
    await route.fulfill({ response, json: body });
  });
  await page.route(`**/v1/projects/${project.id}/retry-setup`, async (route) => {
    retries++;
    if (retries === 1) return route.fulfill({ status: 503, json: { error: "Setup temporarily unavailable" } });
    setupBlocked = false;
    await route.continue();
  });
  await page.route(`**/v1/agents/info?projectId=${project.id}`, async (route) => {
    await route.fulfill(setupBlocked ? { status: 503, json: { error: "Availability unavailable" } } : { json: [] });
  });
  await page.goto(`/projects/${project.id}`);
  const home = homeFrame(page);
  await expect(home.getByText("Setup needs recovery", { exact: true })).toBeVisible();
  await home.getByRole("button", { name: "Retry setup", exact: true }).click();
  await expect(home.getByText(/Setup temporarily unavailable/)).toBeVisible();
  await home.getByRole("button", { name: "Retry setup", exact: true }).click();
  await expect(home.getByRole("button", { name: "Retry setup", exact: true })).toHaveCount(0);
  await expect(home.getByText("Could not check agent availability", { exact: true })).toBeVisible();
  await home.getByRole("button", { name: "Check again", exact: true }).click();
  await expect(home.getByText("No agent available", { exact: true })).toBeVisible();
  expect(retries).toBe(2);
});
