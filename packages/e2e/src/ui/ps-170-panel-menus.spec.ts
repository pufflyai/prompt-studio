import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { expect, type Locator, type Page, test } from "@playwright/test";
import { STORY_RENDER_TIMEOUT_MS, startStorybook, stopStorybook, storyUrl } from "./mermaid-renderer-storybook";

const apiPort = Number(process.env.E2E_API_PORT ?? "3200");
const apiBase = `http://localhost:${apiPort}`;

const openTabCustomMenu = async (tab: import("@playwright/test").Locator) => {
  if ((await tab.getAttribute("aria-selected")) !== "true") await tab.click();
  await expect(tab).toHaveAttribute("aria-selected", "true");
  await tab.click();
};
const sidePanelsStoryId = "pstdio-workbench-onboarding--side-panels";
const locationSwitchStoryId = "pstdio-workbench-onboarding--location-switch";
const allPanelsStoryId = "pstdio-workbench-onboarding--all-three-panels";
const widgetVariantsStoryId = "pstdio-workbench-onboarding--widget-variants";
const bubbleFreeLocationStoryId = "pstdio-workbench-onboarding--bubble-free-location";

interface MenuCase {
  panel: "Main" | "Secondary" | "Side";
  side: "left" | "right";
  contentRegion: "main" | "secondary" | "side";
}

const testedMenus: MenuCase[] = [
  { panel: "Main", side: "left", contentRegion: "main" },
  { panel: "Secondary", side: "right", contentRegion: "secondary" },
  { panel: "Side", side: "left", contentRegion: "side" },
];

const panelId = (panel: MenuCase["panel"]) => panel.toLowerCase();
const menuName = (entry: MenuCase) => `${entry.panel} ${entry.side} menu`;
const menuRegion = (page: Page, entry: MenuCase) =>
  page.locator(`[data-workbench-panel-menu="${panelId(entry.panel)}-${entry.side}"]`);

const createSession = async (
  request: import("@playwright/test").APIRequestContext,
  projectId: string,
  title: string,
) => {
  const response = await request.post(`${apiBase}/v1/sessions`, {
    data: {
      project_id: projectId,
      title,
      prompt: title,
      agent: "pstdio.extension-lab.fake",
    },
  });
  expect(response.ok()).toBe(true);
};

const dragMenuClosed = async (page: Page, menu: Locator, separator: Locator, side: MenuCase["side"]) => {
  const [menuBox, separatorBox] = await Promise.all([menu.boundingBox(), separator.boundingBox()]);
  expect(menuBox).not.toBeNull();
  expect(separatorBox).not.toBeNull();
  const startX = separatorBox!.x + separatorBox!.width / 2;
  const y = separatorBox!.y + separatorBox!.height / 2;
  const targetX = side === "left" ? menuBox!.x + 40 : menuBox!.x + menuBox!.width - 40;
  await page.mouse.move(startX, y);
  await page.mouse.down();
  await page.mouse.move(targetX, y);
  await page.mouse.up();
};

test("PS-170 preserves Forward history when refreshing after Back", async ({ page, request }) => {
  const response = await request.post(`${apiBase}/v1/projects`, { data: { name: "PS-170 History" } });
  expect(response.ok()).toBe(true);
  const project = (await response.json()) as { id: string };
  await page.addInitScript((projectId: string) => {
    localStorage.setItem("onboarding-complete", "true");
    localStorage.setItem("dashboard-wb:selected-project:global", projectId);
  }, project.id);
  await page.goto(`/projects/${project.id}/tickets`);

  await page.getByRole("option", { name: "Tickets", exact: true }).click();
  await page.getByRole("option", { name: "Sessions", exact: true }).click();
  await page.getByRole("button", { name: "Navigate back" }).click();
  await expect(page.getByRole("link", { name: "Tickets", exact: true })).toBeVisible();

  await page.reload();
  const forward = page.getByRole("button", { name: "Navigate forward" });
  await expect(forward).toBeEnabled();
  await forward.click();
  await expect(page.getByRole("link", { name: "Sessions", exact: true })).toBeVisible();
});

test("PS-170 keeps the project selector and Session Panel available on project home", async ({ page, request }) => {
  const response = await request.post(`${apiBase}/v1/projects`, { data: { name: "PS-170 Project Chrome" } });
  expect(response.ok()).toBe(true);
  const project = (await response.json()) as { id: string };
  await page.addInitScript((projectId: string) => {
    localStorage.setItem("onboarding-complete", "true");
    localStorage.setItem("dashboard-wb:selected-project:global", projectId);
  }, project.id);

  await page.goto(`/projects/${project.id}/`);

  await expect(page.getByRole("button", { name: "Switch project" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Open Side Panel" })).toBeVisible();
});

test("PS-170 preserves other Session tabs when selecting from New session", async ({ page, request }) => {
  const response = await request.post(`${apiBase}/v1/projects`, { data: { name: "PS-170 Session Sub Panels" } });
  expect(response.ok()).toBe(true);
  const project = (await response.json()) as { id: string };
  await createSession(request, project.id, "First context session");
  await createSession(request, project.id, "Second context session");
  await page.addInitScript((projectId: string) => {
    localStorage.setItem("onboarding-complete", "true");
    localStorage.setItem("selected-agent", "pstdio.extension-lab.fake");
    localStorage.setItem("dashboard-wb:selected-project:global", projectId);
  }, project.id);
  await page.goto(`/projects/${project.id}/tickets`);
  await page.getByRole("option", { name: "Tickets", exact: true }).click();

  await page.getByRole("button", { name: "Show Side Panel" }).click();
  const sideHeader = page.locator('[data-workbench-panel-header="side"]');
  await sideHeader.getByRole("button", { name: "Add panel" }).click();
  const sessionTabs = sideHeader.getByRole("tab");
  await expect(sessionTabs).toHaveCount(1);

  await openTabCustomMenu(sessionTabs.first());
  const menu = page.getByRole("menu", { name: "New session menu" });
  const newSession = menu.getByRole("menuitem", { name: "New session" });
  const viewAllSessions = menu.getByRole("menuitem", { name: "View all sessions" });
  await expect(newSession).toBeVisible();
  await expect(viewAllSessions).toBeVisible();
  await expect(menu.getByRole("menuitem").first()).toContainText("New session");
  await expect(menu.getByRole("menuitem").last()).toContainText("View all sessions");
  await expect(menu.getByRole("separator")).toHaveCount(2);
  await expect(viewAllSessions.locator("svg")).toHaveClass(/lucide-arrow-up-right/);

  await menu.getByRole("menuitem", { name: "First context session" }).click();
  await expect(sideHeader.getByRole("tab", { name: /First context session/ })).toBeVisible();
  await expect(sessionTabs).toHaveCount(2);

  const firstNewSessionTab = sideHeader.getByRole("tab", { name: /New session/ });
  await firstNewSessionTab.click();
  await firstNewSessionTab.getByRole("button", { name: "Close New session" }).click();
  await expect(sessionTabs).toHaveCount(1);

  await openTabCustomMenu(sideHeader.getByRole("tab", { name: /First context session/ }));
  await page
    .getByRole("menu", { name: "First context session menu" })
    .getByRole("menuitem", { name: "Second context session" })
    .click();
  await expect(sideHeader.getByRole("tab", { name: /Second context session/ })).toBeVisible();
  await expect(sessionTabs).toHaveCount(1);

  await sideHeader.getByRole("button", { name: "Add panel" }).click();
  await expect(sessionTabs).toHaveCount(2);

  await openTabCustomMenu(sideHeader.getByRole("tab", { name: /New session/ }));
  await page
    .getByRole("menu", { name: "New session menu" })
    .getByRole("menuitem", { name: "First context session" })
    .click();
  await expect(sessionTabs).toHaveCount(3);
  await expect(sideHeader.getByRole("tab", { name: /Second context session/ })).toBeVisible();
  await expect(sideHeader.getByRole("tab", { name: /New session/ })).toBeVisible();
  await expect(sideHeader.getByRole("tab", { name: /First context session/ })).toBeVisible();

  await openTabCustomMenu(sideHeader.getByRole("tab", { name: /First context session/ }));
  await page
    .getByRole("menu", { name: "First context session menu" })
    .getByRole("menuitem", { name: "Second context session" })
    .click();
  await expect(sessionTabs).toHaveCount(3);
  await expect(sideHeader.getByRole("tab", { name: /Second context session/ })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.getByRole("region", { name: "Side Panel" })).toBeVisible();
});

test("PS-170 updates a New session Sub Panel in place after the first message", async ({ page, request }) => {
  const response = await request.post(`${apiBase}/v1/projects`, { data: { name: "PS-170 Draft Session" } });
  expect(response.ok()).toBe(true);
  const project = (await response.json()) as { id: string };
  await page.addInitScript((projectId: string) => {
    localStorage.setItem("onboarding-complete", "true");
    localStorage.setItem("selected-agent", "pstdio.extension-lab.fake");
    localStorage.setItem("dashboard-wb:selected-project:global", projectId);
  }, project.id);
  await page.goto(`/projects/${project.id}/tickets`);
  await page.getByRole("option", { name: "Tickets", exact: true }).click();

  await page.getByRole("button", { name: "Show Side Panel" }).click();
  const sideHeader = page.locator('[data-workbench-panel-header="side"]');
  await sideHeader.getByRole("button", { name: "Add panel" }).click();
  const sessionTabs = sideHeader.getByRole("tab");
  await expect(sessionTabs).toHaveCount(1);
  await expect(sessionTabs.first()).toContainText("New session");

  const prompt = "Continue in this session tab";
  await page.locator("[data-testid='content-editable'][contenteditable='true']").last().fill(prompt);
  await page.locator("[data-testid='send-message-button']").last().click();

  await expect(sessionTabs).toHaveCount(1);
  await expect(sessionTabs.first()).toContainText(prompt);
  await expect(page).toHaveURL(new RegExp(`/projects/${project.id}/tickets$`));
});

test("PS-170 hides unavailable Side Panel chrome in the Sessions Location", async ({ page, request }) => {
  const response = await request.post(`${apiBase}/v1/projects`, { data: { name: "PS-170 Empty Sessions" } });
  expect(response.ok()).toBe(true);
  const project = (await response.json()) as { id: string };
  await page.addInitScript((projectId: string) => {
    localStorage.setItem("onboarding-complete", "true");
    localStorage.setItem("dashboard-wb:selected-project:global", projectId);
  }, project.id);

  await page.goto(`/projects/${project.id}/sessions`);
  await page.getByRole("option", { name: "Sessions", exact: true }).click();

  await expect(
    page.getByRole("navigation", { name: "breadcrumb" }).getByText("Sessions", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Show Side Panel" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Open Side Panel" })).toHaveCount(0);
  await expect(page.getByTestId("workbench-side-panel-floating")).toHaveCount(0);
});

test.describe("PS-170 Panel-owned menus", () => {
  test.slow();

  let baseUrl: string;
  let storybook: ChildProcessWithoutNullStreams | undefined;

  test.beforeAll(async () => {
    ({ baseUrl, storybook } = await startStorybook(sidePanelsStoryId, "pstdio-workbench"));
  });

  test.afterAll(async () => {
    await stopStorybook(storybook);
  });

  test("shows all six headerless menus and reattaches one menu for every Panel type", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(storyUrl(baseUrl, sidePanelsStoryId));
    const sidePanel = page.locator('[data-workbench-panel="side"]');
    const sideSeparator = page.getByRole("separator", { name: "Resize Side Panel" });
    const [sideWidth, sideSeparatorBox] = await Promise.all([
      sidePanel.evaluate((element) => element.clientWidth),
      sideSeparator.boundingBox(),
    ]);
    expect(sideSeparatorBox).not.toBeNull();
    const sideStartX = sideSeparatorBox!.x + sideSeparatorBox!.width / 2;
    const sideY = sideSeparatorBox!.y + sideSeparatorBox!.height / 2;
    await page.mouse.move(sideStartX, sideY);
    await page.mouse.down();
    await page.mouse.move(sideStartX - (520 - sideWidth), sideY);
    await page.mouse.up();
    await expect.poll(() => sidePanel.evaluate((element) => element.clientWidth)).toBe(520);

    for (const panel of ["main", "secondary", "side"]) {
      for (const side of ["left", "right"]) {
        const menu = page.locator(`[data-workbench-panel-menu="${panel}-${side}"]`);
        await expect(menu).toBeVisible({ timeout: 30_000 });
        await expect(menu.locator("[data-workbench-panel-header]")).toHaveCount(0);
        await expect(menu.getByRole("button", { name: /^Close/ })).toHaveCount(0);
      }
    }

    for (const entry of testedMenus) {
      const menu = menuRegion(page, entry);
      const contentNode = await page
        .locator(`[data-workbench-region="${entry.contentRegion}"]`)
        .first()
        .elementHandle();
      expect(contentNode).not.toBeNull();
      await dragMenuClosed(page, menu, page.getByRole("separator", { name: `Resize ${menuName(entry)}` }), entry.side);

      await expect(menu).not.toBeVisible();
      expect(await contentNode!.evaluate((element) => element.isConnected)).toBe(true);

      const header = page.locator(`[data-workbench-panel-header="${panelId(entry.panel)}"]`);
      const trigger = header.getByRole("button", { name: `Open ${menuName(entry)}` });
      await expect(trigger).toBeVisible();
      await trigger.click();

      const controls = page.locator(
        `[data-workbench-panel-menu-controls="${panelId(entry.panel)}-${entry.side}-menu"]`,
      );
      await expect(controls).toBeVisible();
      await expect(controls).toHaveAttribute("role", "menu");
      await expect
        .poll(async () => {
          const [triggerBox, controlsBox] = await Promise.all([trigger.boundingBox(), controls.boundingBox()]);
          if (!triggerBox || !controlsBox) return Number.POSITIVE_INFINITY;
          return Math.abs(controlsBox.y - (triggerBox.y + triggerBox.height));
        })
        .toBeLessThanOrEqual(1);
      await expect(controls).toHaveCSS("box-shadow", "none");
      await expect(controls.getByText("Reattach", { exact: true })).toHaveCount(0);
      await expect(controls.getByRole("region", { name: menuName(entry) })).toBeVisible();

      const attach = controls.getByRole("button", { name: `Attach ${menuName(entry)}` });
      await expect(attach).toHaveCount(1);
      await attach.click();
      await expect(menu).toBeVisible();
      await expect(trigger).toHaveCount(0);
      expect(await contentNode!.evaluate((element) => element.isConnected)).toBe(true);
    }
  });

  test("switches exclusively between Location and Sub Panel menus", async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.goto(storyUrl(baseUrl, locationSwitchStoryId));

    const locationTab = page.getByRole("tab", { name: /^Alpha location/ });
    const notesTab = page.getByRole("tab", { name: /Notes/ });
    await expect(locationTab).toBeVisible({ timeout: STORY_RENDER_TIMEOUT_MS });
    await expect(locationTab.getByRole("button", { name: /Close/ })).toHaveCount(0);
    await expect(notesTab).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("button", { name: "Open Main left menu" })).toHaveCount(0);

    const notesMenuTrigger = page.getByRole("button", { name: "Open Main right menu" });
    await expect(notesMenuTrigger).toBeVisible();
    await notesMenuTrigger.hover();
    await expect(page.getByRole("tooltip").getByText("Notes tools")).toBeVisible();

    await locationTab.click();
    await expect(locationTab).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("button", { name: "Open Main left menu" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Open Main right menu" })).toHaveCount(0);

    await page.getByRole("button", { name: "Navigate back" }).click();
    await expect(notesTab).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("button", { name: "Open Main right menu" })).toBeVisible();
    await page.getByRole("button", { name: "Navigate forward" }).click();
    await expect(locationTab).toHaveAttribute("aria-selected", "true");
  });

  test("gives every Notes Sub Panel the same menus", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(storyUrl(baseUrl, allPanelsStoryId));

    for (const panel of ["main", "secondary", "side"]) {
      await expect(page.locator(`[data-workbench-panel-menu="${panel}-right"]`)).toContainText("Notes tools", {
        timeout: STORY_RENDER_TIMEOUT_MS,
      });
      await expect(page.locator(`[data-workbench-panel-menu="${panel}-left"]`)).toHaveCount(0);
    }
  });

  test("disables Attach when the Panel is too narrow", async ({ page }) => {
    await page.setViewportSize({ width: 250, height: 800 });
    await page.goto(storyUrl(baseUrl, locationSwitchStoryId));

    await page.getByRole("button", { name: "Open Main right menu" }).click();
    const attach = page.getByRole("button", { name: "Attach Main right menu" });
    await expect(attach).toBeDisabled();
    await attach.hover();
    await expect(page.getByRole("tooltip").getByText("Panel is too narrow to attach this menu")).toBeVisible();
  });

  test("keeps a bubble-free Location clear while retaining attached Side Panel recovery", async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.goto(storyUrl(baseUrl, bubbleFreeLocationStoryId));

    await expect(page.getByRole("button", { name: "Show Side Panel" })).toBeVisible({
      timeout: STORY_RENDER_TIMEOUT_MS,
    });
    await expect(page.getByRole("button", { name: "Open Side Panel" })).toHaveCount(0);
    await expect(page.getByTestId("workbench-side-panel-floating")).toHaveCount(0);

    await page.getByRole("button", { name: "Show Side Panel" }).click();
    await expect(page.getByTestId("workbench-side-panel-attached")).toBeVisible();
  });

  test("documents widget variants as one Location Panel with tabbed Sub Panels", async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.goto(storyUrl(baseUrl, widgetVariantsStoryId));

    const tabs = page.getByRole("tablist");
    await expect(tabs.getByRole("tab", { name: /^Widget variants/ })).toBeVisible({ timeout: STORY_RENDER_TIMEOUT_MS });
    await expect(tabs.getByRole("tab", { name: /^Closable singleton/ })).toBeVisible();
    await expect(tabs.getByRole("tab", { name: /^Alpha note/ })).toBeVisible();
    await expect(tabs.getByRole("tab", { name: /^Beta note/ })).toBeVisible();
    await expect(tabs.getByRole("tab", { name: /^Scratch 1/ })).toBeVisible();
    await expect(
      tabs.getByRole("tab", { name: /^Widget variants/ }).getByRole("button", { name: /Close/ }),
    ).toHaveCount(0);

    await page.getByRole("button", { name: "New scratch Sub Panel" }).click();
    await expect(tabs.getByRole("tab", { name: /^Scratch 2/ })).toBeVisible();
  });
});
