import { expect, test } from "@playwright/test";
import { openCanvasPreview } from "../preview";

// Critical: older history must stay reachable through scrolling and keyboard navigation after a failed read.
test("scrolling appends sibling sessions, retains keyboard focus, and retries inline", async ({ page }) => {
  const frame = await openCanvasPreview(
    page,
    "packages/pstdio-workbench/src/react/renderers/tree/tree-pagination.canvas.tsx#InfiniteHistory",
  );
  const requests = frame.getByLabel("Page requests");
  await expect(requests).toHaveText("0");
  const first = frame.getByRole("option", { name: "Session 1", exact: true });
  await first.click();
  await frame.getByRole("button", { name: "Fail next read", exact: true }).click();
  await first.focus();
  await first.press("End");
  await expect(frame.getByRole("option", { name: "Session 20", exact: true })).toBeFocused();
  await expect(frame.getByText("Could not load older sessions.", { exact: true })).toBeVisible();
  await expect(requests).toHaveText("1");
  await frame.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(requests).toHaveText("2");
  const viewport = frame.locator("[data-scope=scroll-area][data-part=viewport]");
  await viewport.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await expect(requests).toHaveText("3");
  await viewport.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await expect(requests).toHaveText("4");
  await viewport.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await expect(frame.getByRole("option", { name: "Session 65", exact: true })).toBeVisible();
  await expect(requests).toHaveText("4");
  const last = frame.getByRole("option", { name: "Session 65", exact: true });
  await last.focus();
  const scrollTop = await viewport.evaluate((element) => element.scrollTop);
  // A live provider event refreshes without taking focus from the reader.
  await frame.getByRole("button", { name: "Refresh", exact: true }).evaluate((button) => {
    if (button instanceof HTMLElement) button.click();
  });
  await expect(requests).toHaveText("7");
  await expect(last).toBeFocused();
  expect(await viewport.evaluate((element) => element.scrollTop)).toBeCloseTo(scrollTop, 0);
});

test("collapsed workspace groups do not fetch and search cancels held history pages", async ({ page }) => {
  const frame = await openCanvasPreview(
    page,
    "packages/pstdio-workbench/src/react/renderers/tree/tree-pagination.canvas.tsx#InfiniteHistory",
  );
  await frame.getByRole("button", { name: "Toggle workspace group", exact: true }).click();
  const group = frame.getByRole("option", { name: "Sessions", exact: true });
  await group.click();
  await expect(frame.getByRole("option", { name: "Session 1", exact: true })).toHaveCount(0);
  await expect(frame.getByLabel("Page requests")).toHaveText("0");
  await group.click();
  await frame.getByRole("button", { name: "Hold reads", exact: true }).click();
  const first = frame.getByRole("option", { name: "Session 1", exact: true });
  await first.press("End");
  await expect(frame.getByLabel("Page requests")).toHaveText("1");
  await frame.getByRole("textbox", { name: "Search sessions" }).fill("New");
  await expect(frame.getByRole("option", { name: "New Session 1", exact: true })).toBeVisible();
  await frame.getByRole("button", { name: "Finish reads", exact: true }).click();
  await expect(frame.getByRole("option", { name: "Session 21", exact: true })).toHaveCount(0);
  await expect(frame.getByRole("option", { name: "New Session 1", exact: true })).toBeVisible();
  await frame.getByRole("option", { name: "New Session 1", exact: true }).press("End");
  await expect(frame.getByLabel("Page requests")).toHaveText("2");
  const viewport = frame.locator("[data-scope=scroll-area][data-part=viewport]");
  await viewport.evaluate((element) => {
    element.scrollTop = 0;
  });
  await group.click();
  await frame.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(group).toHaveAttribute("aria-expanded", "false");
  await expect(frame.getByLabel("Page requests")).toHaveText("2");
  await group.click();
  await expect(frame.getByLabel("Page requests")).toHaveText("3");
});
