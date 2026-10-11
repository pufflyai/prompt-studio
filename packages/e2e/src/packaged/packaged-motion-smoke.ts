import { expect, type Page } from "@playwright/test";

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
};

// Packaged chat must retain earlier DOM as live chunks arrive, then become quiet.
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
  const text = page
    .locator('[data-rich-message="true"] [data-lexical-text="true"]')
    .filter({ hasText: /^Step 1\./ })
    .first();
  await expect(text).toBeVisible();
  const earlier = await text.elementHandle();
  await expect(page.locator(".streaming-text-chunk").first()).toBeAttached();
  await expect
    .poll(
      async () => {
        const state = await fetch(`${baseUrl}/v1/sessions/${session.id}`, { headers });
        return ((await state.json()) as { status: string }).status;
      },
      { timeout: 15_000 },
    )
    .toBe("completed");
  await expect(page.getByText(/^Step 30\./).first()).toBeVisible();
  expect(await earlier?.evaluate((element) => element.isConnected)).toBe(true);
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
};
