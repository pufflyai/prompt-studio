import { expect, test } from "@playwright/test";
import { openCanvasPreview } from "../preview";

// Critical: timeline controls must remain reachable and keyframe edits must preserve focus and authored neighbours.
test("scrub, move, add and delete animation keys through the shared timeline", async ({ page }) => {
  const preview = await openCanvasPreview(
    page,
    "packages/ui/src/components/keyframe-timeline/keyframe-timeline.canvas.tsx#Animation",
  );
  const ruler = preview.getByRole("slider", { name: "Timeline playhead" });
  await ruler.focus();
  await ruler.press("Home");
  await ruler.press("ArrowRight");
  await expect(ruler).toHaveAttribute("aria-valuenow", "0.04");
  await preview.getByRole("button", { name: "Restart", exact: true }).click();
  await expect(ruler).toHaveAttribute("aria-valuenow", "0");
  const first = preview.getByRole("button", { name: "Opacity keyframe 0:00:00", exact: true });
  await first.click();
  await first.press("ArrowRight");
  const moved = preview.getByRole("button", { name: "Opacity keyframe 0:00:01", exact: true });
  await expect(moved).toBeFocused();
  await expect(preview.getByRole("button", { name: "Opacity keyframe 0:01:00", exact: true })).toBeVisible();
  await moved.press("Shift+ArrowRight");
  await preview.getByRole("button", { name: "Opacity keyframe 0:00:11", exact: true }).press("Shift+ArrowRight");
  for (let frame = 21; frame < 25; frame++) {
    await preview
      .getByRole("button", { name: `Opacity keyframe 0:00:${frame.toString().padStart(2, "0")}`, exact: true })
      .press("ArrowRight");
  }
  const collision = preview.getByRole("button", { name: "Opacity keyframe 0:00:24", exact: true });
  await expect(collision).toBeFocused();
  await expect(preview.getByRole("button", { name: "Opacity keyframe 0:01:00", exact: true })).toBeVisible();
  const bounds = await collision.boundingBox();
  await page.mouse.move(bounds!.x + bounds!.width / 2, bounds!.y + bounds!.height / 2);
  await page.mouse.down();
  await page.mouse.move(bounds!.x + bounds!.width / 2 + 40, bounds!.y + bounds!.height / 2);
  await page.mouse.up();
  await expect(collision).toHaveCount(0);
  // Select through the live tree rather than assuming a drag distance maps to one CSS pixel per frame.
  const active = preview
    .locator('button[aria-pressed="true"]')
    .filter({ has: preview.locator("span") })
    .first();
  await active.press("Delete");
  await expect(preview.getByRole("button", { name: "Opacity", exact: true })).toBeFocused();
  await ruler.focus();
  await ruler.press("Home");
  await ruler.press("ArrowRight");
  const opacityLabel = preview.getByRole("button", { name: "Opacity", exact: true });
  await opacityLabel.focus();
  await opacityLabel.press("Shift+F10");
  await preview.getByRole("menuitem", { name: "Add keyframe at 0:00:01", exact: true }).click();
  await expect(preview.getByRole("button", { name: "Opacity keyframe 0:00:01", exact: true })).toBeVisible();
  const top = preview.getByRole("button", { name: "Top keyframe 0:00:06", exact: true });
  await top.click();
  await expect(preview.getByRole("toolbar", { name: "Animation controls" })).toHaveCount(1);
  await expect(preview.getByRole("spinbutton")).toHaveCount(0);
  await expect(preview.getByText("Interpolation", { exact: true })).toHaveCount(0);
  await expect(preview.getByRole("button", { name: /Zoom (in|out) timeline/ })).toHaveCount(0);
  await preview.getByRole("button", { name: "Bullet 2", exact: true }).click();
  await expect(preview.getByRole("button", { name: "Opacity", exact: true })).toHaveCount(0);
  const loopStart = preview.getByRole("slider", { name: "Loop start", exact: true });
  const loopEnd = preview.getByRole("slider", { name: "Loop end", exact: true });
  await loopStart.press("ArrowRight");
  await expect(loopStart).toHaveAttribute("aria-valuenow", "0.24");
  const edge = (await loopEnd.boundingBox())!;
  await page.mouse.move(edge.x + edge.width / 2, edge.y + edge.height / 2);
  await page.mouse.down();
  await page.mouse.move(edge.x + edge.width / 2 - 40, edge.y + edge.height / 2);
  await page.mouse.up();
  expect(Number(await loopEnd.getAttribute("aria-valuenow"))).toBeLessThan(1.8);
  await loopStart.press("End");
  expect(Number(await loopStart.getAttribute("aria-valuenow"))).toBeLessThan(
    Number(await loopEnd.getAttribute("aria-valuenow")),
  );
});

// Critical: the shared playhead must be reachable across the track area without taking over key/loop gestures.
test("drag the playhead from track space and along its full height", async ({ page }) => {
  const preview = await openCanvasPreview(
    page,
    "packages/ui/src/components/keyframe-timeline/keyframe-timeline.canvas.tsx#Animation",
  );
  const playhead = preview.getByRole("slider", { name: "Timeline playhead", exact: true });
  const row = await preview.getByRole("button", { name: "Opacity", exact: true }).boundingBox();
  const ruler = (await playhead.boundingBox())!;
  const x = (time: number) => ruler.x + (time / 2) * ruler.width;
  const drag = async (fromX: number, toX: number, y: number) => {
    await page.mouse.move(fromX, y);
    await page.mouse.down();
    await page.mouse.move(toX, y);
    await page.mouse.up();
  };
  const y = row!.y + row!.height / 2;
  await drag(x(0.4), x(0.8), y);
  await expect(playhead).toHaveAttribute("aria-valuenow", "0.8");
  await expect(playhead).toBeFocused();
  await drag(x(1.2), x(1.6), y);
  await expect(playhead).toHaveAttribute("aria-valuenow", "1.6");
  const marker = await preview.getByRole("button", { name: "Settled", exact: true }).boundingBox();
  await drag(x(1.6), x(1.2), marker!.y + marker!.height / 2);
  await expect(playhead).toHaveAttribute("aria-valuenow", "1.2");
  const group = await preview.getByRole("button", { name: "Bullet 2", exact: true }).boundingBox();
  await drag(x(1.2), x(0.8), group!.y + group!.height / 2);
  await expect(playhead).toHaveAttribute("aria-valuenow", "0.8");
  await expect(preview.getByRole("button", { name: "Bullet 2", exact: true })).toHaveAttribute("aria-expanded", "true");
  await expect(preview.getByRole("button", { name: "Opacity keyframe 0:00:00", exact: true })).toBeVisible();
  await expect(preview.getByRole("button", { name: "Opacity keyframe 0:01:00", exact: true })).toBeVisible();
});

// Critical: the ruler, keys, markers and drag hit area must indicate the same moment.
test("ruler and marker positions align with the full-height playhead", async ({ page }) => {
  const preview = await openCanvasPreview(
    page,
    "packages/ui/src/components/keyframe-timeline/keyframe-timeline.canvas.tsx#Animation",
  );
  const ruler = preview.getByRole("slider", { name: "Timeline playhead", exact: true });
  const tracks = preview.getByRole("group", { name: "Animation tracks", exact: true });
  const bodyLine = tracks.locator('[aria-hidden="true"] > div');
  const rulerLine = ruler.locator(":scope > div").last();
  const marker = preview.getByRole("button", { name: "Settled", exact: true });
  await marker.click();
  await expect(ruler).toHaveAttribute("aria-valuenow", "1.5");
  const geometry = async () => {
    const body = (await bodyLine.boundingBox())!;
    const line = (await rulerLine.boundingBox())!;
    const mark = (await marker.boundingBox())!;
    return { body, line, mark };
  };
  const positions = await geometry();
  expect(Math.abs(positions.body.x - (positions.mark.x + positions.mark.width / 2))).toBeLessThanOrEqual(1);
  expect(Math.abs(positions.body.x - positions.line.x)).toBeLessThanOrEqual(1);
  const authored = preview.getByRole("button", { name: "Top keyframe 0:00:06", exact: true });
  await authored.click();
  await expect(ruler).toHaveAttribute("aria-valuenow", "0.25");
  const key = (await authored.boundingBox())!;
  const keyed = await geometry();
  expect(Math.abs(keyed.body.x - (key.x + key.width / 2))).toBeLessThanOrEqual(1);
  expect(Math.abs(keyed.body.x - keyed.line.x)).toBeLessThanOrEqual(1);
  await ruler.press("Home");
  const start = await geometry();
  expect(Math.abs(start.body.x - start.line.x)).toBeLessThanOrEqual(1);
  await ruler.press("End");
  const end = await geometry();
  expect(Math.abs(end.body.x - end.line.x)).toBeLessThanOrEqual(1);
});

// Critical: animated collapse must retain rows without leaving exiting keys in keyboard navigation.
test("groups reveal retained tracks with the shared chevron and motion", async ({ page }) => {
  const preview = await openCanvasPreview(
    page,
    "packages/ui/src/components/keyframe-timeline/keyframe-timeline.canvas.tsx#Animation",
  );
  const group = preview.getByRole("button", { name: "Bullet 2", exact: true });
  const key = preview.getByRole("button", { name: "Opacity keyframe 0:01:00", exact: true });
  const original = (await key.elementHandle())!;
  await key.click();
  await group.click();
  await expect(group).toHaveAttribute("aria-expanded", "false");
  await group.press("Tab");
  await expect(preview.getByRole("button", { name: "Bullet 1", exact: true })).toBeFocused();
  expect(await original.evaluate((element) => element.isConnected)).toBe(true);
  await group.click();
  await expect(key).toBeVisible();
  await expect(key).toHaveAttribute("aria-pressed", "true");
  await expect(group.locator("svg")).toBeVisible();
  await expect(group).toHaveText("Bullet 2");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await group.click();
  await expect(key).toBeHidden();
  await group.click();
  await expect(key).toBeVisible();
  expect(await original.evaluate((element) => element.isConnected)).toBe(true);
});

// Critical: revealing grouped tracks must not detach sticky labels from the horizontal scroll viewport.
test("group labels stay fixed while long tracks scroll horizontally", async ({ page }) => {
  const preview = await openCanvasPreview(
    page,
    "packages/ui/src/components/keyframe-timeline/keyframe-timeline.canvas.tsx#Long",
  );
  const label = preview.getByRole("button", { name: "Opacity", exact: true });
  const time = preview.getByRole("button", { name: "Time", exact: true });
  const before = (await label.boundingBox())!;
  const header = (await time.boundingBox())!;
  const viewport = preview
    .getByRole("group", { name: "Animation tracks", exact: true })
    .locator('[data-part="viewport"]');
  await viewport.evaluate((element) => {
    element.scrollLeft = 400;
  });
  await expect.poll(() => viewport.evaluate((element) => element.scrollLeft)).toBeGreaterThan(100);
  const after = (await label.boundingBox())!;
  expect(Math.abs(after.x - before.x)).toBeLessThanOrEqual(1);
  expect(Math.abs((await time.boundingBox())!.x - header.x)).toBeLessThanOrEqual(1);
});

// Critical: the shared clipping change must preserve nested application-tree disclosure and retained state.
test("shared reveal keeps nested app tree rows usable", async ({ page }) => {
  const preview = await openCanvasPreview(
    page,
    "packages/ui/src/components/tree-list/tree-list-motion.canvas.tsx#NestedGroups",
  );
  const research = preview.locator('[data-tree-list-node-id="research"]');
  const notes = preview.locator('[data-tree-list-node-id="notes"]');
  await research.click();
  await expect(notes).toBeVisible();
  const original = (await notes.elementHandle())!;
  await research.click();
  await expect(notes).toBeHidden();
  expect(await original.evaluate((element) => element.isConnected)).toBe(true);
  await research.click();
  await expect(notes).toBeVisible();
  await preview.getByText("Workspaces", { exact: true }).click();
  await expect(research).toBeHidden();
  await preview.getByText("Workspaces", { exact: true }).click();
  await expect(notes).toBeVisible();
  expect(await original.evaluate((element) => element.isConnected)).toBe(true);
});

// Critical: context actions must edit the track/time under the pointer and preserve keyboard editing focus.
test("keyframe context menus target the clicked track and position", async ({ page }) => {
  const preview = await openCanvasPreview(
    page,
    "packages/ui/src/components/keyframe-timeline/keyframe-timeline.canvas.tsx#Animation",
  );
  const top = preview.getByRole("group", { name: "Bullet 1 / Top track", exact: true });
  const opacity = preview.getByRole("group", { name: "Bullet 2 / Opacity track", exact: true });
  const ruler = preview.getByRole("slider", { name: "Timeline playhead", exact: true });
  const bounds = (await ruler.boundingBox())!;
  const row = (await top.boundingBox())!;
  await page.mouse.click(bounds.x + bounds.width * 0.4, row.y + row.height / 2, { button: "right" });
  const add = preview.getByRole("menuitem", { name: "Add keyframe at 0:00:20", exact: true });
  await expect(add).toBeVisible();
  await add.click();
  const created = top.getByRole("button", { name: "Top keyframe 0:00:20", exact: true });
  await expect(created).toHaveAttribute("aria-pressed", "true");
  await expect(created).toBeFocused();
  await expect(top).toHaveAttribute("data-active", "true");
  await expect(ruler).toHaveAttribute("aria-valuenow", "0.8");
  await expect(opacity.getByRole("button", { name: "Opacity keyframe 0:00:20", exact: true })).toHaveCount(0);
  await created.press("Shift+F10");
  await expect(preview.getByRole("menuitem", { name: "Delete keyframe", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(created).toBeFocused();
  await opacity.getByRole("button", { name: "Opacity keyframe 0:00:00", exact: true }).click();
  await created.click({ button: "right" });
  await preview.getByRole("menuitem", { name: "Delete keyframe", exact: true }).click();
  await expect(created).toHaveCount(0);
  const label = top.getByRole("button", { name: "Top", exact: true });
  await expect(label).toBeFocused();
  await ruler.focus();
  await ruler.press("Home");
  await ruler.press("ArrowRight");
  await label.focus();
  await label.press("Shift+F10");
  await preview.getByRole("menuitem", { name: "Add keyframe at 0:00:01", exact: true }).click();
  const keyboardKey = top.getByRole("button", { name: "Top keyframe 0:00:01", exact: true });
  await expect(keyboardKey).toBeFocused();
  await keyboardKey.press("Shift+F10");
  await preview.getByRole("menuitem", { name: "Delete keyframe", exact: true }).click();
  await expect(keyboardKey).toHaveCount(0);
  await expect(label).toBeFocused();
});
