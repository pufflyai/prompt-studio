import { type APIRequestContext, expect, type Page, test } from "@playwright/test";
import { folderProjectInput } from "../helpers/folder-project";
import { homeFrame, homePage } from "../helpers/home-loading";
import { installPresentationTool } from "../helpers/presentation-tool";

const openDefaultPage = async (page: Page) => {
  await page.keyboard.press("Alt+Shift+K");
  const palette = page.getByRole("dialog", { name: "Command palette" });
  await palette.getByRole("textbox").fill(">Open default page");
  await palette.getByRole("option", { name: /Open default page/ }).click();
};

const emptyMain = (page: Page) => {
  const main = page.locator('[data-workbench-panel="main"]');
  return main
    .getByRole("group", { name: "Available tabs", exact: true })
    .or(main.getByText("No tabs available", { exact: true }));
};

test("Home resumes opened resources and public actions without prematurely creating a session", async ({
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
  await expect(homeFrame(page).getByText("Nothing opened yet", { exact: true })).toBeVisible();
  await expect(page.getByRole("option").first()).toHaveText("Home");
  const session = sessions[6];
  await page.goto(
    `/projects/${project.id}/session?resource=${encodeURIComponent(`pstdio://extension-resource/session/${session.id}`)}`,
  );
  await expect(page.getByRole("navigation", { name: "breadcrumb" })).toContainText(session.title);
  await page.getByRole("button", { name: "Back to project", exact: true }).click();
  await page.getByRole("option", { name: "Home", exact: true }).click();
  const recent = homeFrame(page).getByRole("button", { name: session.title, exact: true });
  await expect(recent).toBeVisible();
  await expect(recent.getByLabel(/Session status/)).toBeVisible();
  await recent.click();
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
  await page.goto(`/projects/${project.id}/extensions/pstdio.pstdio-workspaces/workspaces`);
  await expect(page).toHaveURL(new RegExp(`/projects/${project.id}/extensions/pstdio.pstdio-workspaces/workspaces$`));
  await expect(
    page.locator('[data-workbench-region="main"] [data-workbench-view="pstdio.pstdio-workspaces.view.workspaces"]'),
  ).toBeVisible();
  await page.getByRole("option", { name: "Sessions", exact: true }).click();
  await page.getByRole("button", { name: "Back to project", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/projects/${project.id}/extensions/pstdio.pstdio-workspaces/workspaces$`));
});

test("Home keeps setup recovery feedback beside the action", async ({ page, request }) => {
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
  try {
    await page.goto(`/projects/${project.id}`);
    const home = homeFrame(page);
    await expect(home.getByText("Setup needs recovery", { exact: true })).toBeVisible();
    await home.getByRole("button", { name: "Retry setup", exact: true }).click();
    await expect(home.getByText(/Setup temporarily unavailable/)).toBeVisible();
    await home.getByRole("button", { name: "Retry setup", exact: true }).click();
    await expect(home.getByRole("button", { name: "Retry setup", exact: true })).toHaveCount(0);
    expect(retries).toBe(2);
  } finally {
    // Assertions are complete; late read injections may finish after interception is removed.
    await page.unrouteAll({ behavior: "ignoreErrors" });
  }
});

const presentationProject = async (page: Page, request: APIRequestContext) => {
  const created = await request.post("/v1/projects", { data: folderProjectInput({ name: "Replaceable tools" }) });
  expect(created.ok()).toBe(true);
  const project = (await created.json()) as { id: string };
  const cleanup = await installPresentationTool(request, project.id);
  const workspacesUrl = `/v1/workspaces?project_id=${project.id}`;
  const before = (await (await request.get(workspacesUrl)).json()) as { id: string; isDefault: boolean }[];
  const sessionResponse = await request.post("/v1/sessions", {
    data: {
      project_id: project.id,
      title: "Retained conversation",
      prompt: "Keep running __fake_hold__",
      agent: "pstdio.workbench-fixture.harness.fake",
    },
  });
  expect(sessionResponse.ok()).toBe(true);
  const session = await sessionResponse.json();
  await expect
    .poll(async () => (await (await request.get(`/v1/sessions/${session.id}`)).json()).status)
    .toBe("in_progress");
  await page.goto(`/projects/${project.id}`);
  await expect(homePage(page)).toBeVisible();
  const toggle = async (names: string[]) => {
    await page.getByRole("option", { name: "Extensions", exact: true }).click();
    for (const name of names) {
      const row = page.getByTestId("extension-entry").filter({ hasText: name });
      const changed = page.waitForResponse(
        (response) =>
          response.url().includes(`/v1/projects/${project.id}/extensions/`) && response.request().method() === "PATCH",
      );
      await row.locator(`label[aria-label="Toggle ${name}"]`).click();
      expect((await changed).ok()).toBe(true);
    }
  };
  return {
    project,
    before,
    toggle,
    chooseDefault: async (alternative: boolean) => {
      const response = await request.put(`/v1/projects/${project.id}/composition`, {
        data: {
          defaultPage: alternative
            ? { kind: "page", extensionId: "test.presentation-tool", id: "welcome" }
            : { kind: "page", extensionId: "pstdio.pstdio-home", id: "home" },
          resourceOpeners: [
            {
              resourceKind: { kind: "resource-kind", extensionId: "pstdio", id: "workspace" },
              opener: { kind: "command", extensionId: "test.presentation-tool", id: "inspect-record" },
            },
          ],
        },
      });
      expect(response.ok(), await response.text()).toBe(true);
    },
    assertRetained: async () => {
      expect(await (await request.get(workspacesUrl)).json()).toEqual(before);
      expect((await (await request.get(`/v1/sessions/${session.id}`)).json()).status).toBe("in_progress");
    },
    dispose: async () => {
      try {
        await request.delete(`/v1/projects/${project.id}`);
      } finally {
        cleanup();
      }
    },
  };
};
const bundledPresentation = ["Home", "Workspaces", "Prompt Studio Cloud"];

// Critical risk: explicit project choices must work with independently installed pages and arbitrary paths.
test("configured ordinary tools open the default and workspace resources without reserved page roles", async ({
  page,
  request,
}) => {
  const fixture = await presentationProject(page, request);
  const { project } = fixture;
  try {
    await fixture.chooseDefault(true);
    await fixture.toggle(bundledPresentation);
    const alternative = page
      .getByRole("region", { name: "Main", exact: true })
      .frameLocator('iframe[title="Alternative presentation"]');
    await page.goto(`/projects/${project.id}`);
    await expect(alternative.getByRole("heading", { name: "Alternative welcome" })).toBeVisible();
    await page.reload();
    await expect(alternative.getByRole("heading", { name: "Alternative welcome" })).toBeVisible();
    await page.goto(`/projects/${project.id}/extensions/test.presentation-tool/collection`);
    await expect(alternative.getByRole("heading", { name: "Alternative catalog" })).toBeVisible();
    const workspace = fixture.before.find((item) => item.isDefault)!;
    const response = await request.post(`/v1/projects/${project.id}/resource-openings`, {
      data: {
        resources: [{ type: "workspace", extensionId: "pstdio", projectId: project.id, id: workspace.id }],
      },
    });
    expect(response.ok(), await response.text()).toBe(true);
    const [opening] = await response.json();
    expect(opening.target.page).toEqual({ kind: "page", extensionId: "test.presentation-tool", id: "inspect" });
    const resource = encodeURIComponent(`pstdio://extension-resource/workspace/${workspace.id}?extensionId=pstdio`);
    await page.goto(`/projects/${project.id}/extensions/test.presentation-tool/reading-room?resource=${resource}`);
    await expect(alternative.getByRole("heading", { name: "Alternative inspect" })).toBeVisible();
    const cloud = page
      .getByRole("group", { name: "Alternative presentation", exact: true })
      .frameLocator('iframe[title="Alternative presentation"]');
    await expect(cloud.getByText("Cloud signed out", { exact: true })).toBeVisible();
    expect((await request.get("/v1/account")).ok()).toBe(true);
    expect((await request.get(`/v1/account/projects/${project.id}/sync`)).ok()).toBe(true);
    await fixture.assertRetained();
  } finally {
    await fixture.dispose();
  }
});

// Critical risk: absence must retain recovery controls, shared records, and a live session.
test("disabled presentation preserves host work and recovers through extension controls", async ({ page, request }) => {
  const fixture = await presentationProject(page, request);
  try {
    await fixture.chooseDefault(true);
    await fixture.toggle(bundledPresentation);
    await fixture.toggle(["Alternative presentation"]);
    await openDefaultPage(page);
    await expect(emptyMain(page)).toBeVisible();
    await expect(page.getByRole("option", { name: "Notes", exact: true })).toBeVisible();
    await expect(page.getByRole("option", { name: "Sessions", exact: true })).toBeVisible();
    await fixture.assertRetained();
    await fixture.toggle(bundledPresentation);
    await openDefaultPage(page);
    await expect(emptyMain(page)).toBeVisible();
    await fixture.chooseDefault(false);
    await page.reload();
    await openDefaultPage(page);
    await expect(homePage(page)).toBeVisible();
    await expect(page.locator('iframe[title="Home"]')).toHaveCount(1);
    await fixture.assertRetained();
  } finally {
    await fixture.dispose();
  }
});
