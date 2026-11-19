import { expect, type FrameLocator } from "@playwright/test";
import type { Execute } from "./packaged-planner-runtime-fixture";

// A long dependency chain exercises actual installed Planner data and variable card heights.
export async function expectPlannerWindow(timeline: FrameLocator, execute: Execute, trackId: string) {
  const tickets: { id: string }[] = [];
  for (let index = 0; index < 80; index++) {
    const ticket = await execute("create-ticket", {
      content: `# Windowed ${index} ${index % 7 === 0 ? "with a long title that wraps onto several lines in the shared card" : "work"}`,
      tagIds: [trackId],
      dependsOn: tickets.length ? [tickets.at(-1)!.id] : [],
    });
    tickets.push(ticket);
  }
  await timeline.getByRole("button", { name: "Search this view", exact: true }).click();
  const search = timeline.getByRole("textbox", { name: "Search this view", exact: true });
  await search.fill("Windowed");
  const viewport = timeline.locator("[data-timeline-viewport]");
  const cards = timeline.locator("[data-ticket]");
  const first = timeline.locator(`[data-ticket="${tickets[0]!.id}"]`);
  await expect(first).toBeInViewport();
  // Command completion and the first card do not fence asynchronous graph refreshes.
  await expect(timeline.locator("[data-edge-layer] g")).toHaveCount(tickets.length - 1);
  await expect.poll(() => cards.count()).toBeLessThan(tickets.length / 2);
  const initialCards = await cards.count();
  await first.focus();
  await expect(first).toBeFocused();
  const initialHeight = await first.evaluate((card) => card.getBoundingClientRect().height);
  const jump = await viewport.evaluate((element) => {
    const before = { top: element.scrollTop, height: element.scrollHeight, viewport: element.clientHeight };
    element.scrollTo({ top: element.scrollHeight });
    return { before, after: { top: element.scrollTop, height: element.scrollHeight } };
  });
  console.info("Timeline bottom jump", jump);
  const last = timeline.locator(`[data-ticket="${tickets.at(-1)!.id}"]`);
  try {
    await expect(last).toBeInViewport();
  } catch (error) {
    console.info(
      "Timeline failed bottom state",
      await viewport
        .evaluate(
          (element) => ({
            top: element.scrollTop,
            height: element.scrollHeight,
            viewport: element.clientHeight,
            cards: [...element.querySelectorAll<HTMLElement>("[data-ticket]")].map((card) => card.dataset.ticket),
            edges: element.querySelectorAll("[data-edge-layer] g").length,
          }),
          undefined,
          { timeout: 1_000 },
        )
        .catch(() => ({ unavailable: true })),
    );
    throw error;
  }
  await expect
    .poll(() => viewport.evaluate((element) => element.scrollHeight - element.clientHeight - element.scrollTop))
    .toBeLessThanOrEqual(1);
  await expect(first).toBeAttached();
  await expect.poll(() => cards.count()).toBeLessThan(tickets.length / 2);
  console.info("Timeline window", { tickets: tickets.length, initialCards, finalCards: await cards.count() });
  await expect(timeline.locator("[data-edge-layer] g")).toHaveCount(tickets.length - 1);
  await viewport.focus();
  await expect(first).toHaveCount(0);
  await viewport.evaluate((element) => element.scrollTo({ top: 0 }));
  await expect(first).toBeInViewport();
  await expect.poll(() => first.evaluate((card) => card.getBoundingClientRect().height)).toBe(initialHeight);
  await timeline.getByRole("button", { name: "Zoom out", exact: true }).click();
  await expect(
    timeline.getByRole("button", { name: "Reset zoom to 100%, current zoom 90%", exact: true }),
  ).toBeVisible();
  await expect(first).toBeInViewport();
  await first.focus();
  await viewport.evaluate((element) => element.scrollTo({ top: element.scrollHeight }));
  await expect(last).toBeInViewport();
  await expect(first).toBeAttached();
  await expect.poll(() => first.evaluate((card) => card.contains(card.ownerDocument.activeElement))).toBe(true);
  await viewport.focus();
  await search.press("Escape");
}
