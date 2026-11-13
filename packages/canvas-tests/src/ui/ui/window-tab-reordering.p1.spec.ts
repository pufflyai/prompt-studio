import { expect, test } from "@playwright/test";
import { openCanvasPreview } from "../preview";

// Critical: active-only close controls must not prevent dragging a project in either direction.
test("reorders project tabs by pointer with only the active tab showing a close control", async ({ page }) => {
  const preview = await openCanvasPreview(
    page,
    "packages/ui/src/components/tab-strip/window-tabs.canvas.tsx#PointerReordering",
  );
  const tabs = preview.getByRole("tablist", { name: "Project tabs" }).getByRole("tab");
  const active = preview.getByRole("tab", { name: "Docs", exact: true });
  await expect(preview.getByRole("button", { name: /^Close / })).toHaveCount(1);
  const dragTo = async (name: string, fraction = 0.5) => {
    const from = (await active.boundingBox())!;
    const to = (await preview.getByRole("tab", { name, exact: true }).boundingBox())!;
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(to.x + to.width * fraction, to.y + to.height / 2, { steps: 12 });
    await page.mouse.up();
  };
  await dragTo("Agentic design");
  await expect(tabs).toHaveText(["Agentic kanban", "Agentic design", "Docs"]);
  await dragTo("Agentic kanban");
  await expect(tabs).toHaveText(["Docs", "Agentic kanban", "Agentic design"]);
  await expect(active).toHaveAttribute("aria-selected", "true");
  // Explicit insertion edges still win over the directional center-drop fallback.
  await dragTo("Agentic design", 0.2);
  await expect(tabs).toHaveText(["Agentic kanban", "Docs", "Agentic design"]);
  const from = (await active.boundingBox())!;
  const strip = (await preview.getByRole("tablist", { name: "Project tabs" }).boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(strip.x + strip.width + 40, from.y + from.height / 2, { steps: 12 });
  await page.mouse.up();
  await expect(tabs).toHaveText(["Agentic kanban", "Docs", "Agentic design"]);
});
