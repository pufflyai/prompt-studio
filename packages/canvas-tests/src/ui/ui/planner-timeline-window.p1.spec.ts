import { expect, type Locator, test } from "@playwright/test";
import { openCanvasPreview } from "../preview";

const canvas = "extensions/pstdio-planner/src/timeline/view/plan-root.canvas.tsx#WindowedPlan";
const settle = (viewport: Locator) =>
  viewport.evaluate(
    () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
  );

const edge = async (viewport: Locator, axis: "left" | "top", end: boolean) => {
  await viewport.evaluate(
    (element, input) => {
      element.scrollTo(
        input.axis === "left"
          ? { left: input.end ? element.scrollWidth : 0 }
          : { top: input.end ? element.scrollHeight : 0 },
      );
    },
    { axis, end },
  );
  await settle(viewport);
};

const anchor = (viewport: Locator) =>
  viewport.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    const cards = [...element.querySelectorAll<HTMLElement>("[data-ticket]")];
    const card = cards.find((card) => {
      const rect = card.getBoundingClientRect();
      return (
        rect.right > bounds.left && rect.left < bounds.right && rect.bottom > bounds.top && rect.top < bounds.bottom
      );
    })!;
    const rect = card.getBoundingClientRect();
    return { id: card.dataset.ticket!, left: rect.left - bounds.left, top: rect.top - bounds.top };
  });

// Critical: independent work shares a graph row, so later windows must be reachable horizontally.
test("parallel tickets page right and left without bouncing to the previous window", async ({ page }) => {
  const preview = await openCanvasPreview(page, canvas);
  const viewport = preview.getByRole("region", { name: "Project Timeline canvas" });
  await expect(viewport.locator("[data-ticket]").first()).toBeVisible();
  await preview.getByRole("button", { name: "Zoom out", exact: true }).click();
  await edge(viewport, "left", true);
  const before = await anchor(viewport);
  await preview.getByRole("button", { name: "Hold next window", exact: true }).click();
  await viewport.dispatchEvent("wheel", { deltaX: 80, deltaY: 0 });
  await expect(preview.getByRole("status", { name: "Requested windows" })).toContainText('"offset":100');
  await expect(preview.getByRole("button", { name: /Reset zoom.*90%/ })).toBeVisible();
  await preview.getByRole("button", { name: "Release window", exact: true }).click();
  const card = viewport.locator(`[data-ticket="${before.id}"]`);
  await expect(card).toBeVisible();
  await settle(viewport);
  const position = await card.evaluate((element) => {
    const bounds = element.closest("[data-timeline-viewport]")!.getBoundingClientRect();
    const rect = element.getBoundingClientRect();
    return { left: rect.left - bounds.left, top: rect.top - bounds.top };
  });
  expect(position.left).toBeCloseTo(before.left, 0);
  expect(position.top).toBeCloseTo(before.top, 0);
  const requests = JSON.parse((await preview.getByRole("status", { name: "Requested windows" }).textContent())!);
  expect(requests.at(-1).viewer).toEqual(requests[0].viewer);
  await edge(viewport, "left", true);
  await expect(viewport.locator('[data-ticket="ticket-299"]')).toBeVisible();
  await viewport.dispatchEvent("wheel", { deltaX: 80, deltaY: 0 });
  await settle(viewport);
  await expect(viewport.locator('[data-ticket="ticket-299"]')).toBeVisible();
  await edge(viewport, "left", false);
  await viewport.dispatchEvent("wheel", { deltaX: -80, deltaY: 0 });
  await edge(viewport, "left", false);
  await expect(viewport.locator('[data-ticket="ticket-0"]')).toBeVisible();
});

// Critical: a failed neighbour must leave the current work usable and offer its own Retry.
test("an adjacent failure retains the graph and retries that window before allowing more paging", async ({ page }) => {
  const preview = await openCanvasPreview(page, canvas);
  const viewport = preview.getByRole("region", { name: "Project Timeline canvas" });
  await expect(viewport.locator("[data-ticket]").first()).toBeVisible();
  await edge(viewport, "left", true);
  await preview.getByRole("button", { name: "Hold next window", exact: true }).click();
  await viewport.dispatchEvent("wheel", { deltaX: 80, deltaY: 0 });
  const requests = preview.getByRole("status", { name: "Requested windows" });
  await expect(requests).toContainText('"offset":100');
  await preview.getByRole("button", { name: "Fail window", exact: true }).click();
  await expect(preview.getByRole("button", { name: "Retry", exact: true })).toBeVisible();
  await expect(viewport.locator('[data-ticket="ticket-199"]')).toBeVisible();
  const failed = await requests.textContent();
  await viewport.dispatchEvent("wheel", { deltaX: 80, deltaY: 0 });
  await settle(viewport);
  await expect(requests).toHaveText(failed!);
  await preview.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(preview.getByRole("button", { name: "Retry", exact: true })).toHaveCount(0);
  await edge(viewport, "left", true);
  await expect(viewport.locator('[data-ticket="ticket-299"]')).toBeVisible();
});

// Critical: retained cards cannot cross a search or project boundary, even after an old reply arrives.
test("search and project changes discard a pending window and fence its delayed reply", async ({ page }) => {
  const preview = await openCanvasPreview(page, canvas);
  const viewport = preview.getByRole("region", { name: "Project Timeline canvas" });
  await expect(viewport.locator("[data-ticket]").first()).toBeVisible();
  await edge(viewport, "left", true);
  await preview.getByRole("button", { name: "Hold next window", exact: true }).click();
  await viewport.dispatchEvent("wheel", { deltaX: 80, deltaY: 0 });
  await expect(preview.getByRole("status", { name: "Requested windows" })).toContainText('"offset":100');
  await preview.getByRole("button", { name: "Search this view", exact: true }).click();
  await preview.getByRole("textbox").fill("Work item 300");
  await expect(viewport.locator('[data-ticket="ticket-299"]')).toBeVisible();
  await expect(viewport.locator("[data-ticket]")).toHaveCount(1);
  await preview.getByRole("button", { name: "Switch project", exact: true }).click();
  await expect(viewport.locator('[data-ticket="ticket-0"]')).toContainText("timeline-story-2");
  await preview.getByRole("button", { name: "Release window", exact: true }).click();
  await settle(viewport);
  await expect(viewport.locator('[data-ticket="ticket-0"]')).toContainText("timeline-story-2");
  await expect(viewport.getByText(/timeline-story-1:/)).toHaveCount(0);
  await viewport.evaluate((element) => {
    element.dataset.reviewMarker = "old-host";
  });
  await preview.getByRole("button", { name: "Replace host", exact: true }).click();
  await expect(viewport.locator('[data-ticket="ticket-0"]')).toBeVisible();
  await expect(viewport).not.toHaveAttribute("data-review-marker", "old-host");
});

// Critical: child controls and zoom gestures must not page; viewport arrow keys must reach later work.
test("only viewport pan gestures advance a window", async ({ page }) => {
  const preview = await openCanvasPreview(page, canvas);
  const viewport = preview.getByRole("region", { name: "Project Timeline canvas" });
  await expect(viewport.locator("[data-ticket]").first()).toBeVisible();
  await edge(viewport, "left", true);
  const requests = preview.getByRole("status", { name: "Requested windows" });
  const initial = await requests.textContent();
  await viewport.dispatchEvent("wheel", { deltaX: 80, deltaY: 0, ctrlKey: true });
  await settle(viewport);
  await expect(requests).toHaveText(initial!);
  await viewport.getByRole("button", { name: "Collapse Unscheduled", exact: true }).press("ArrowRight");
  await settle(viewport);
  await expect(requests).toHaveText(initial!);
  await edge(viewport, "left", true);
  await viewport.focus();
  await viewport.press("ArrowRight");
  await expect(requests).toContainText('"offset":100');
});

// Critical: low zoom can fit a complete bounded window while more matching work remains.
test("a window that fits on both axes can continue and return with viewport arrows", async ({ page }) => {
  const preview = await openCanvasPreview(page, canvas);
  await preview.getByRole("button", { name: "Dependency layers", exact: true }).click();
  const viewport = preview.getByRole("region", { name: "Project Timeline canvas" });
  await expect(viewport.locator('[data-ticket="ticket-0"]')).toContainText("timeline-story-2:");
  await viewport.dispatchEvent("wheel", { deltaY: 2_000, ctrlKey: true });
  await expect(preview.getByRole("button", { name: /Reset zoom.*25%/ })).toBeVisible();
  await settle(viewport);
  expect(
    await viewport.evaluate(
      (element) => element.scrollWidth <= element.clientWidth && element.scrollHeight <= element.clientHeight,
    ),
  ).toBe(true);
  await viewport.focus();
  await viewport.press("ArrowDown");
  const requests = preview.getByRole("status", { name: "Requested windows" });
  await expect(requests).toContainText('"offset":100');
  await viewport.press("ArrowUp");
  await expect.poll(async () => JSON.parse((await requests.textContent())!).at(-1).offset).toBe(0);
});

// Critical: a single large pan can reach the edge before virtualization has mounted an anchor there.
for (const axis of ["horizontal", "vertical"] as const) {
  test(`a single large ${axis} pan preserves overlapping work across the next window`, async ({ page }) => {
    const preview = await openCanvasPreview(page, canvas);
    if (axis === "vertical") await preview.getByRole("button", { name: "Dependency chain", exact: true }).click();
    const viewport = preview.getByRole("region", { name: "Project Timeline canvas" });
    await expect(viewport.locator('[data-ticket="ticket-0"]')).toBeVisible();
    if (axis === "vertical")
      await expect(viewport.locator('[data-ticket="ticket-0"]')).toContainText("timeline-story-2:");
    await viewport.dispatchEvent("wheel", {
      deltaX: axis === "horizontal" ? 100_000 : 0,
      deltaY: axis === "vertical" ? 100_000 : 0,
    });
    await expect(preview.getByRole("status", { name: "Requested windows" })).toContainText('"offset":100');
    await expect(viewport.locator('[data-ticket="ticket-199"]')).toBeVisible();
    await expect(viewport.locator('[data-ticket="ticket-299"]')).toHaveCount(0);
  });
}

// Critical: a portalled card menu owns its wheel events even when the graph is at a page edge.
test("wheeling a card menu does not advance the underlying graph", async ({ page }) => {
  const preview = await openCanvasPreview(page, canvas);
  const viewport = preview.getByRole("region", { name: "Project Timeline canvas" });
  await expect(viewport.locator("[data-ticket]").first()).toBeVisible();
  await edge(viewport, "left", true);
  await viewport.locator('[data-ticket="ticket-199"]').click({ button: "right" });
  const action = preview.getByRole("menuitem", { name: "Inspect ticket", exact: true });
  await expect(action).toBeVisible();
  expect(await action.evaluate((element) => Boolean(element.closest("[data-timeline-viewport]")))).toBe(false);
  const requests = preview.getByRole("status", { name: "Requested windows" });
  const initial = await requests.textContent();
  await action.dispatchEvent("wheel", { deltaX: 80, deltaY: 0 });
  await settle(viewport);
  await expect(requests).toHaveText(initial!);
  await action.press("Escape");
  await expect(action).toHaveCount(0);
});

// Critical: loading an adjacent page must preserve the active graph, zoom and both anchor coordinates.
test("a held vertical window keeps its viewport and restores the overlapping card", async ({ page }) => {
  const preview = await openCanvasPreview(page, canvas);
  await preview.getByRole("button", { name: "Dependency chain", exact: true }).click();
  const viewport = preview.getByRole("region", { name: "Project Timeline canvas" });
  await expect(viewport.locator("[data-ticket]").first()).toBeVisible();
  await preview.getByRole("button", { name: "Zoom out", exact: true }).click();
  await viewport.evaluate((element) => {
    element.dataset.reviewMarker = "retained";
  });
  await edge(viewport, "top", true);
  const before = await anchor(viewport);
  await preview.getByRole("button", { name: "Hold next window", exact: true }).click();
  await viewport.dispatchEvent("wheel", { deltaX: 0, deltaY: 80 });
  await expect(preview.getByRole("status", { name: "Requested windows" })).toContainText('"offset":100');
  await expect(viewport).toHaveAttribute("data-review-marker", "retained");
  await expect(preview.getByRole("button", { name: /Reset zoom.*90%/ })).toBeVisible();
  await preview.getByRole("button", { name: "Release window", exact: true }).click();
  const card = viewport.locator(`[data-ticket="${before.id}"]`);
  await expect(card).toBeVisible();
  await settle(viewport);
  const after = await card.evaluate((element) => {
    const bounds = element.closest("[data-timeline-viewport]")!.getBoundingClientRect();
    const rect = element.getBoundingClientRect();
    return { left: rect.left - bounds.left, top: rect.top - bounds.top };
  });
  expect(after.left).toBeCloseTo(before.left, 0);
  expect(after.top).toBeCloseTo(before.top, 0);
  await expect(viewport).toHaveAttribute("data-review-marker", "retained");
  await edge(viewport, "top", true);
  await expect(viewport.locator('[data-ticket="ticket-299"]')).toBeVisible();
  await edge(viewport, "top", false);
  await viewport.dispatchEvent("wheel", { deltaX: 0, deltaY: -80 });
  await edge(viewport, "top", false);
  await expect(viewport.locator('[data-ticket="ticket-0"]')).toBeVisible();
});
