import { expect, test } from "@playwright/test";
import { openCanvasPreview } from "../preview";

// Critical: settled layout must not erase a newer keyboard choice under a stationary pointer.
test("menu layout keeps the newer keyboard selection when an old hovered item moves away", async ({ page }, info) => {
  const preview = await openCanvasPreview(
    page,
    "packages/ui/src/components/overlays/resource-context-menu.canvas.tsx#Default",
  );
  await preview.getByText("Right-click here", { exact: true }).click({ button: "right" });
  const first = preview.getByRole("menuitem", { name: "Sidenav entry 1", exact: true });
  const last = preview.getByRole("menuitem", { name: "Sidenav entry 4", exact: true });
  const menu = preview.getByRole("menu");
  await expect(first).toBeVisible();
  await menu.evaluate(async (element) => {
    await Promise.all(element.getAnimations({ subtree: true }).map((animation) => animation.finished));
  });
  await first.hover();
  await expect(first).toHaveAttribute("data-highlighted", "");
  await expect(menu).toBeFocused();
  const before = await first.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const events: object[] = [];
    element.ownerDocument.addEventListener(
      "pointerout",
      (event) => {
        if (event.target instanceof Node && element.contains(event.target))
          events.push({ trusted: event.isTrusted, x: event.clientX, y: event.clientY });
      },
      { capture: true, passive: true },
    );
    Reflect.set(element, "geometryLeaveEvidence", events);
    return { x: rect.x, y: rect.y, height: rect.height, width: rect.width };
  });
  await page.keyboard.press("End");
  await expect(last).toHaveAttribute("data-highlighted", "");
  await first.evaluate(async (element) => {
    // Move geometry only; do not move the pointer, focus or menu state.
    (element as HTMLElement).style.transform = `translateY(-${element.getBoundingClientRect().height + 8}px)`;
    for (let frame = 0; frame < 3; frame++) await new Promise(requestAnimationFrame);
  });
  const after = await first.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return { y: rect.y, events: Reflect.get(element, "geometryLeaveEvidence") };
  });
  await info.attach("stationary-pointer-layout-controls", {
    body: JSON.stringify({ before, after }),
    contentType: "application/json",
  });
  expect(after.y).toBeLessThan(before.y - before.height);
  expect(
    after.events.some(
      (event: { trusted: boolean; x: number; y: number }) =>
        event.trusted &&
        event.x >= before.x &&
        event.x <= before.x + before.width &&
        event.y >= before.y &&
        event.y <= before.y + before.height,
    ),
  ).toBe(true);
  await expect(menu).toBeFocused();
  await expect(last).toHaveAttribute("data-highlighted", "");
});
