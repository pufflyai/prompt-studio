import { expect, test } from "@playwright/test";
import { folderProjectInput } from "../helpers/folder-project";
import { fakeHarnessId, switchSession } from "../helpers/session-side-panel";
import { uiOrigin as apiBase } from "../ui-server";

test("dragging a terminal into headerless Main retains its live view and shell state", async ({ page, request }) => {
  const response = await request.post(`${apiBase}/v1/projects`, {
    data: folderProjectInput({ name: "Arrange a live terminal" }),
  });
  expect(response.ok()).toBe(true);
  const project = await response.json();
  await page.addInitScript((id: string) => {
    localStorage.setItem("onboarding-complete", "true");
    localStorage.setItem("dashboard-wb2:selected-project:global", id);
  }, project.id);
  await page.goto(`/projects/${project.id}/`);
  await expect(page.getByText("Project home", { exact: true })).toBeVisible();
  const originalUrl = page.url();
  const main = page.getByRole("region", { name: "Main", exact: true });
  const mainHeader = page.locator('[data-workbench-panel-header="main"]');
  await expect(mainHeader).not.toBeVisible();
  await page.getByRole("button", { name: "Show Bottom Panel", exact: true }).click();
  const secondary = page.locator('[data-workbench-panel-header="secondary"]');
  await secondary.getByRole("button", { name: "Add panel", exact: true }).click();
  await page.getByRole("menuitem", { name: "Terminal", exact: true }).click();
  const terminal = page.locator(".xterm:visible");
  await expect(terminal).toHaveCount(1);
  await terminal.evaluate((element) => {
    (window as Window & { retainedTerminal?: Element }).retainedTerminal = element;
  });
  await terminal.click();
  const input = page.getByRole("textbox", { name: "Terminal input" });
  await input.pressSequentially("export ARRANGEMENT_STATE=kept");
  await input.press("Enter");
  const tab = secondary.getByRole("tab");
  const instanceId = await tab.locator("..").getAttribute("data-workbench-tab");
  const start = (await tab.boundingBox())!;
  const target = (await main.boundingBox())!;
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
  await page.mouse.down();
  await page.mouse.move(start.x + start.width / 2 + 10, start.y + start.height / 2, { steps: 3 });
  // The top edge moves a sole Bottom tab and its panel to the opposite edge.
  await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 12 });
  await expect(page.locator('[data-workbench-tab-drop="main"][data-drop-active]')).toBeVisible();
  await page.mouse.up();
  await expect(mainHeader.getByRole("tab")).toHaveCount(2);
  const moved = mainHeader.locator(`[data-workbench-tab="${instanceId}"]`).getByRole("tab");
  await expect(moved).toHaveAttribute("aria-selected", "true");
  expect(
    await terminal.evaluate(
      (element) => element === (window as Window & { retainedTerminal?: Element }).retainedTerminal,
    ),
  ).toBe(true);
  await terminal.click();
  await input.pressSequentially('printf "__arrangement_%s__\\n" "$ARRANGEMENT_STATE"');
  await input.press("Enter");
  await expect(terminal.locator(".xterm-rows")).toContainText("__arrangement_kept__");
  expect(page.url()).toBe(originalUrl);
  await expect(secondary.getByRole("tab")).toHaveCount(0);
  await moved.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Reset layout", exact: true }).click();
  await expect(mainHeader).not.toBeVisible();
  await expect(page.getByText("Project home", { exact: true })).toBeVisible();
});

test("moves the live session page through every region and keeps its conversation state", async ({ page, request }) => {
  const project = await (
    await request.post(`${apiBase}/v1/projects`, {
      data: folderProjectInput({ name: "Move the live session page" }),
    })
  ).json();
  const session = await (
    await request.post(`${apiBase}/v1/sessions`, {
      data: {
        project_id: project.id,
        title: "Moving conversation",
        prompt: "Moving __fake_hold__",
        agent: fakeHarnessId,
      },
    })
  ).json();
  const other = await (
    await request.post(`${apiBase}/v1/sessions`, {
      data: { project_id: project.id, title: "Another conversation", prompt: "Another", agent: fakeHarnessId },
    })
  ).json();
  const subscriptions: string[] = [];
  page.on("request", (sent) => {
    if (new URL(sent.url()).pathname.endsWith("/subscriptions") && sent.method() === "POST")
      subscriptions.push(sent.postDataJSON().session_id);
  });
  await page.addInitScript((id) => {
    localStorage.setItem("onboarding-complete", "true");
    localStorage.setItem("dashboard-wb2:selected-project:global", id);
  }, project.id);
  try {
    await page.goto(
      `/projects/${project.id}/session?resource=${encodeURIComponent(`pstdio://extension-resource/session/${session.id}`)}`,
    );
    const editor = page.getByTestId("content-editable").filter({ visible: true });
    await expect(editor).toBeVisible();
    const instance = page.locator("[data-workbench-instance]").filter({ has: editor });
    await editor.fill("Retained conversation draft");
    await instance
      .locator('input[type="file"]')
      .setInputFiles({ name: "context.txt", mimeType: "text/plain", buffer: Buffer.from("Context") });
    await expect(page.getByText("context.txt", { exact: true })).toBeVisible();
    const instanceId = await instance.getAttribute("data-workbench-instance");
    await editor.evaluate((node) => {
      (window as Window & { originalEditor?: Element }).originalEditor = node;
    });
    await expect.poll(() => subscriptions).toEqual([session.id]);
    const url = page.url();
    const history = await page.evaluate(() => window.history.length);
    const source = page
      .locator(`[data-workbench-page-drag="${instanceId}"], [data-workbench-tab="${instanceId}"] [role="tab"]`)
      .filter({ visible: true });
    const drag = async (destination = "side", cancel = false) => {
      await expect(source).toHaveCount(1);
      const start = (await source.boundingBox())!;
      await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
      await page.mouse.down();
      await page.mouse.move(start.x + start.width / 2 + 12, start.y + start.height / 2, { steps: 3 });
      await page.mouse.move(
        (await page.locator('[data-workbench-panel="main"]').boundingBox())!.x + 500,
        start.y + 100,
        { steps: 4 },
      );
      if (cancel) await page.keyboard.press("Escape");
      else {
        const target =
          destination === "side"
            ? page.locator('[data-workbench-edge-hit="side"][data-workbench-edge-position="right"]')
            : page.locator('[data-workbench-panel="main"]');
        await expect(target).toBeAttached();
        const box = (await target.boundingBox())!;
        await page.mouse.move(box.x + box.width / 2, box.y + (destination === "main" ? 4 : box.height / 2), {
          steps: 12,
        });
      }
      await page.mouse.up();
    };
    await drag("side", true);
    await expect(
      page.locator('[data-workbench-panel="main"]').locator(`[data-workbench-instance="${instanceId}"]`),
    ).toBeVisible();
    await drag();
    const assertRetained = async (region: string) => {
      await expect(
        page.locator(`[data-workbench-panel="${region}"] [data-workbench-instance="${instanceId}"]`),
      ).toBeVisible();
      expect(
        await editor.evaluate((node) => node === (window as Window & { originalEditor?: Element }).originalEditor),
      ).toBe(true);
      await expect(editor).toHaveText("Retained conversation draft");
      await expect(page.getByText("context.txt", { exact: true })).toBeVisible();
      expect(page.url()).toBe(url);
      expect(await page.evaluate(() => window.history.length)).toBe(history);
      expect(subscriptions).toEqual([session.id]);
    };
    await assertRetained("side");
    await drag("main");
    await assertRetained("main");
    await drag("side");
    await assertRetained("side");
    for (const [label, region] of [
      ["Bottom", "secondary"],
      ["Main", "main"],
    ]) {
      await source.focus();
      await source.press("Shift+F10");
      await page.getByRole("menuitem", { name: `Move to ${label}`, exact: true }).click();
      await assertRetained(region!);
    }
    await source.focus();
    await source.press("Shift+F10");
    await page.getByRole("menuitem", { name: "Move to Side", exact: true }).click();
    await source.focus();
    await source.press("Shift+F10");
    await switchSession(page, other.title);
    const side = page.locator('[data-workbench-panel="side"]');
    await expect(side.getByTestId("content-editable")).toBeEmpty();
    await side.getByRole("tab", { selected: true }).focus();
    await side.getByRole("tab", { selected: true }).press("Shift+F10");
    await switchSession(page, session.title);
    await expect(side.getByTestId("content-editable")).toHaveText("Retained conversation draft");
    await page.reload();
    await expect(side.getByTestId("content-editable")).toHaveText("Retained conversation draft");
    await side.getByRole("tab", { selected: true }).focus();
    await side.getByRole("tab", { selected: true }).press("Shift+F10");
    await page.getByRole("menuitem", { name: "Reset layout", exact: true }).click();
    await expect(page.locator('[data-workbench-panel="main"]').getByTestId("content-editable")).toHaveText(
      "Retained conversation draft",
    );
  } finally {
    await request.patch(`${apiBase}/v1/sessions/${session.id}/status`, { data: { status: "cancelled" } });
  }
});
