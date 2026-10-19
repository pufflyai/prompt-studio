import { expect, type Page } from "@playwright/test";
import { expectPackagedChatHistory } from "./packaged-chat-history-smoke";

const expectResizedPanelReopen = async (page: Page, label: string, openName: string, direction: number) => {
  const open = page.getByRole("button", { name: openName, exact: true });
  if (await open.isVisible()) await open.click();
  const handle = page.getByRole("separator", { name: label, exact: true, includeHidden: true });
  const dimensions = () =>
    handle.evaluate((element) => {
      const frame = document.getElementById(element.getAttribute("aria-controls")!.split(" ")[0])!;
      return {
        outer: frame.getBoundingClientRect().width,
        inner: frame.querySelector("[data-split-panel-content]")!.getBoundingClientRect().width,
      };
    });
  const settle = () =>
    expect.poll(() => handle.evaluate((element) => element.parentElement!.getAnimations().length)).toBe(0);
  const dragBy = async (delta: number) => {
    const box = (await handle.boundingBox())!;
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + delta, y, { steps: 8 });
    await page.mouse.up();
  };
  await expect(handle).toBeVisible();
  await settle();
  await dragBy(48 * direction);
  await settle();
  const resized = await dimensions();
  await dragBy((20 - resized.outer) * direction);
  await expect(handle).toBeHidden();
  await open.click();
  await expect(handle).toBeVisible();
  await settle();
  const reopened = await dimensions();
  expect(Math.abs(reopened.outer - resized.outer)).toBeLessThan(1);
  expect(Math.abs(reopened.inner - reopened.outer)).toBeLessThan(1);
};

export const expectPackagedPanelMotion = async (page: Page) => {
  const hide = page.getByRole("button", { name: "Hide Side Panel", exact: true });
  if (await hide.isVisible()) await hide.click();
  await page.getByRole("button", { name: "Show Side Panel", exact: true }).click();
  const panel = page.getByTestId("workbench-side-panel-attached");
  await expect(panel).toBeVisible();
  await expect
    .poll(() => panel.evaluate((element) => element.closest("[data-dragging]")!.getAnimations().length))
    .toBe(0);
  const closing = await panel.evaluate(async (element) => {
    const root = element.closest("[data-dragging]")!;
    const frame = element.closest("[data-collapsed]")!;
    (document.querySelector('[aria-label="Hide Side Panel"]') as HTMLElement).click();
    while (root.getAttribute("data-collapsed") !== "true") await new Promise(requestAnimationFrame);
    return {
      width: frame.getBoundingClientRect().width,
      visibility: getComputedStyle(frame).visibility,
      inert: frame.hasAttribute("inert"),
    };
  });
  expect(closing.width).toBeGreaterThan(0);
  expect(closing.visibility).toBe("visible");
  expect(closing.inert).toBe(true);
  await expect(panel).not.toBeVisible();
  expect(await panel.evaluate((element) => element.closest("[data-collapsed]")!.getBoundingClientRect().width)).toBe(0);
  const separator = page.getByRole("separator", { name: "Resize Side Panel", includeHidden: true });
  expect(await separator.evaluate((element) => element.getBoundingClientRect().width)).toBe(0);
  await expectResizedPanelReopen(page, "Resize sidenav", "Show Sidenav", 1);
  await expectResizedPanelReopen(page, "Resize Side Panel", "Show Side Panel", -1);
};

// Visible messages retain their DOM as chunks arrive. Older responses may leave the viewport.
export const expectPackagedStreamingMotion = async (
  page: Page,
  baseUrl: string,
  projectId: string,
  headers: Record<string, string>,
) => {
  const response = await fetch(`${baseUrl}/v1/sessions`, {
    method: "POST",
    headers: { ...headers, "content-type": "application/json" },
    body: JSON.stringify({
      project_id: projectId,
      title: "Motion replay",
      prompt: "Replay __fake_long_stream__",
      agent: "pstdio.workbench-fixture.harness.fake",
    }),
  });
  expect(response.ok).toBe(true);
  const session = (await response.json()) as { id: string };
  await page.getByRole("option", { name: "Motion replay", exact: true }).click();
  const transcript = page.getByRole("log").filter({ visible: true }).first();
  await expect(transcript.locator('[data-scope="scroll-area"][data-part="viewport"]').first()).toBeVisible();
  const text = page
    .locator('[data-rich-message="true"] [data-lexical-text="true"]')
    .filter({ hasText: /^Step 1\./, visible: true })
    .first();
  await expect(text).toBeVisible();
  const earlier = await text.elementHandle();
  await expect(page.locator(".streaming-text-chunk").first()).toBeAttached();
  await expect(
    page
      .getByText(/^Step 2\./)
      .filter({ visible: true })
      .first(),
  ).toBeVisible();
  expect(await earlier?.evaluate((element) => element.isConnected)).toBe(true);
  await expect
    .poll(
      async () => {
        const state = await fetch(`${baseUrl}/v1/sessions/${session.id}`, { headers });
        return ((await state.json()) as { status: string }).status;
      },
      { timeout: 15_000 },
    )
    .toBe("completed");
  await expect(
    page
      .getByText(/^Step 30\./)
      .filter({ visible: true })
      .first(),
  ).toBeVisible();
  expect(await page.locator(".ai-message__root:visible").count()).toBeLessThan(20);
  await expect
    .poll(() =>
      page
        .locator('[data-rich-message="true"]')
        .evaluateAll((elements) =>
          elements.reduce((count, element) => count + element.getAnimations({ subtree: true }).length, 0),
        ),
    )
    .toBe(0);
  await earlier?.dispose();
  await expectPackagedChatHistory(page, session.id);
};
