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
  await preview.getByRole("button", { name: "Add keyframe", exact: true }).click();
  await expect(preview.getByRole("button", { name: "Opacity keyframe 0:00:01", exact: true })).toBeVisible();
  const top = preview.getByRole("button", { name: "Top keyframe 0:00:06", exact: true });
  await top.click();
  await expect(preview.getByRole("toolbar", { name: "Animation controls" })).toHaveCount(1);
  await expect(preview.getByRole("spinbutton")).toHaveCount(0);
  await expect(preview.getByText("Interpolation", { exact: true })).toHaveCount(0);
  await expect(preview.getByRole("button", { name: /Zoom (in|out) timeline/ })).toHaveCount(0);
  for (const name of ["Add keyframe", "Delete keyframe"]) {
    const action = preview.getByRole("button", { name, exact: true });
    await expect(action.locator("svg")).toBeVisible();
    await expect(action).toHaveText("");
  }
  await preview.getByRole("button", { name: /Bullet 2/ }).click();
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
  const group = await preview.getByRole("button", { name: /Bullet 2/ }).boundingBox();
  await drag(x(1.2), x(0.8), group!.y + group!.height / 2);
  await expect(playhead).toHaveAttribute("aria-valuenow", "0.8");
  await expect(preview.getByRole("button", { name: /Bullet 2/ })).toHaveAttribute("aria-expanded", "true");
  await expect(preview.getByRole("button", { name: "Opacity keyframe 0:00:00", exact: true })).toBeVisible();
  await expect(preview.getByRole("button", { name: "Opacity keyframe 0:01:00", exact: true })).toBeVisible();
});
