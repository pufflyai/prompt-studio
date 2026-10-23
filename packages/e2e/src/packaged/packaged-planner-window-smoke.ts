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
  const zoomControls = timeline.getByRole("group", { name: "Canvas zoom", exact: true });
  await expect(zoomControls).toBeVisible();
  const controlsPosition = await zoomControls.boundingBox();
  const cards = timeline.locator("[data-ticket]");
  const first = timeline.locator(`[data-ticket="${tickets[0]!.id}"]`);
  await expect(first).toBeInViewport();
  await expect.poll(() => cards.count()).toBeLessThan(tickets.length / 2);
  const initialCards = await cards.count();
  await first.focus();
  await expect(first).toBeFocused();
  const initialHeight = await first.evaluate((card) => card.getBoundingClientRect().height);
  await viewport.evaluate((element) => element.scrollTo({ top: element.scrollHeight }));
  const last = timeline.locator(`[data-ticket="${tickets.at(-1)!.id}"]`);
  await expect(last).toBeInViewport();
  await expect.poll(() => zoomControls.boundingBox()).toEqual(controlsPosition);
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
  await timeline.getByRole("button", { name: /Reset zoom to/ }).click();
  await viewport.evaluate((element) => {
    element.scrollTo({ top: 0 });
    const bounds = element.getBoundingClientRect();
    for (const deltaY of [100, 100, -100]) {
      element.dispatchEvent(
        new WheelEvent("wheel", {
          bubbles: true,
          cancelable: true,
          ctrlKey: true,
          deltaY,
          clientX: bounds.left + 300,
          clientY: bounds.top + 300,
        }),
      );
    }
  });
  await expect.poll(() => viewport.evaluate((element) => element.scrollTop)).toBeGreaterThan(25);
  await search.press("Escape");
}
