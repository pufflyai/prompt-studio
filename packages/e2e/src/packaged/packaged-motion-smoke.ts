import { expect, type Page } from "@playwright/test";

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
