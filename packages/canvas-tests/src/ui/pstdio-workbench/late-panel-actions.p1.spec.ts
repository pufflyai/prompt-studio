import { expect, test } from "@playwright/test";
import { openCanvasPreview } from "../preview";

test("Side header keyboard menu survives a late movement policy", async ({ page }) => {
  const preview = await openCanvasPreview(
    page,
    "packages/pstdio-workbench/src/react/region/whole-panel-placement.canvas.tsx#LateMoveActions",
  );
  const header = preview.getByLabel("Side panel header", { exact: true });
  await expect(header).toHaveAttribute("data-ps136-position-actions", "0");
  await header.focus();
  await expect(header).toBeFocused();
  await header.press("Shift+F10");
  console.log(
    "PS136_CONTROLLED_AFTER_KEY",
    await header.evaluate((element) => {
      const admission = (window as unknown as { __ps136Admission?: { key: string; before: string; oldNode: Element } })
        .__ps136Admission;
      return {
        header: element.outerHTML,
        active: document.activeElement?.outerHTML,
        oldNodeConnected: admission?.oldNode.isConnected,
        sameNode: admission?.oldNode === element,
        admission: admission ? { key: admission.key, before: admission.before } : null,
      };
    }),
  );
  await expect(header).toHaveAttribute("data-ps136-position-actions", "1");
  await expect(preview.getByRole("menuitem", { name: /^Move panel to / })).toHaveCount(1);
});
