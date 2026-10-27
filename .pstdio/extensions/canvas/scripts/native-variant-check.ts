import { expect, type Frame } from "@playwright/test";
import type { CanvasDefinition } from "../src/canvases/definitions";

export const checkCanvasVariants = async (surface: Frame, canvas: CanvasDefinition) => {
  let checked = 0;
  for (const item of canvas.items) {
    if (!item.variants) continue;
    const frame = surface.locator(`[data-canvas-item="${item.id}"]`);
    for (const variant of item.variants) {
      await frame.getByRole("button", { name: "Variant for" }).focus();
      await frame.getByRole("button", { name: "Variant for" }).click();
      await surface
        .getByRole("menuitem", { name: new RegExp(`^(?:✓ )?${variant.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`) })
        .click();
      await expect(frame.locator("iframe")).toHaveAttribute("data-frame-story", variant.id);
      await expect(frame.locator("iframe")).toHaveAttribute("data-frame-ready", "true");
      await expect(frame.locator("[data-ui-canvas-error]")).toHaveCount(0);
      if (variant.preview.source.endsWith("/diff-viewer/code-editor.stories.tsx")) {
        const document = frame.frameLocator("iframe");
        let editors = 1;
        if (variant.preview.exportName === "Diff") editors = 2;
        if (variant.preview.exportName === "ThemeSwitching") editors = 3;
        await expect(document.locator(".monaco-editor:not(.gutter)")).toHaveCount(editors);
        await expect(document.locator(".view-lines").first()).toContainText(/export|const/);
        if (variant.preview.exportName === "ConstrainedContainer")
          await expect(document.locator(".squiggly-error").first()).toBeVisible();
      }
      checked++;
    }
  }
  return checked;
};
