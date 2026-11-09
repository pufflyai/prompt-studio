import { expect, test } from "@playwright/test";
import { revealTreeEntry } from "../helpers/tree-entry";

test("finds a virtual row after a contribution moves it outside the rendered window", async ({ page }) => {
  await page.setContent('<div role="tree"></div>');
  await page.getByRole("tree").evaluate((tree) => {
    const viewport = document.createElement("div");
    viewport.dataset.scope = "scroll-area";
    viewport.dataset.part = "viewport";
    viewport.style.cssText = "height:96px;width:240px;overflow:auto";
    const content = document.createElement("div");
    content.style.cssText = "height:1920px;position:relative";
    viewport.append(content);
    tree.append(viewport);
    let destination = 0;
    const render = () => {
      const first = Math.floor(viewport.scrollTop / 24);
      content.replaceChildren();
      for (let index = first; index < Math.min(80, first + 5); index++) {
        const row = document.createElement("div");
        row.setAttribute("role", "option");
        row.textContent = index === destination ? "Destination" : `Item ${index}`;
        row.style.cssText = `position:absolute;top:${index * 24}px;height:24px;width:240px`;
        content.append(row);
      }
    };
    viewport.addEventListener("scroll", render);
    viewport.addEventListener("recycle", () => {
      destination = 30;
      tree.setAttribute("data-recycled", "true");
      render();
    });
    render();
  });
  const tree = page.getByRole("tree");
  const destination = tree.getByRole("option", { name: "Destination", exact: true });
  const measureVisibility = destination.isVisible.bind(destination);
  let recycled = false;
  // Keep the real visibility result, but deterministically deliver the virtualizer's update
  // before the helper continues. All selector resolution, geometry and scrolling remain real.
  destination.isVisible = async (options) => {
    const visible = await measureVisibility(options);
    if (visible && !recycled) {
      recycled = true;
      await tree.locator('[data-part="viewport"]').dispatchEvent("recycle");
    }
    return visible;
  };
  await expect.poll(() => revealTreeEntry(page, tree, destination)).toBe(true);
  await expect(tree).toHaveAttribute("data-recycled", "true");
  await expect(destination).toBeVisible();
});
