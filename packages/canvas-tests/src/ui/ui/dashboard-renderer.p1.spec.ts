import { expect, test } from "@playwright/test";
import { openCanvasPreview } from "../preview";

// Critical: cluster membership and share must be visible inside the dashboard widgets.
test("shows grouped scatter points and ring shares on the dashboard", async ({ page }) => {
  const preview = await openCanvasPreview(
    page,
    "packages/ui/src/components/dashboard-renderer/dashboard.canvas.tsx#Dashboard",
  );
  const scatter = preview.getByRole("article", { name: "Conversation clusters", exact: true });
  const scatterPlot = scatter.getByRole("img", { name: "Conversation clusters", exact: true });
  await expect(scatterPlot).toBeVisible();
  await expect(scatter.getByText("Duration (min)", { exact: true })).toBeVisible();
  await expect(scatter.getByText("Long conversations", { exact: true })).toBeVisible();
  const ring = preview.getByRole("article", { name: "Cluster share", exact: true });
  const ringPlot = ring.getByRole("img", { name: "Cluster share", exact: true });
  await expect(ringPlot).toBeVisible();
  await expect(ring.getByText("Short conversations", { exact: true })).toBeVisible();
  await ringPlot.press("ArrowRight");
  await expect(preview.getByText(/^(40|60)%$/)).toBeVisible();
});

test("distinguishes ungrouped observations from caller-named groups", async ({ page }) => {
  const preview = await openCanvasPreview(
    page,
    "packages/ui/src/components/dashboard-renderer/dashboard.canvas.tsx#Dashboard",
  );
  const scatter = preview.getByRole("article", { name: "Conversation clusters", exact: true });
  const legend = scatter.locator(".ts-chart__legend");
  for (const name of ["Unassigned", "0", "No group", "No group (2)", "No group (3)"]) {
    await expect(legend.getByText(name, { exact: true })).toBeVisible();
  }
});

test("reports distinct small coordinates during keyboard navigation", async ({ page }) => {
  const preview = await openCanvasPreview(
    page,
    "packages/ui/src/components/dashboard-renderer/dashboard.canvas.tsx#Dashboard",
  );
  const scatter = preview.getByRole("img", { name: "Conversation clusters", exact: true });
  await scatter.press("Home");
  await expect(preview.getByText("Open intake", { exact: true })).toBeVisible();
  await expect(preview.getByText("0.0001", { exact: true })).toBeVisible();
  await scatter.press("ArrowRight");
  await expect(preview.getByText("Quick check", { exact: true })).toBeVisible();
  await expect(preview.getByText("0.0003", { exact: true })).toBeVisible();
});

// Critical: a page-owned toolbar must still control the dashboard, including widgets with interactive content.
test("edits custom widgets from the page toolbar", async ({ page }) => {
  const preview = await openCanvasPreview(
    page,
    "packages/ui/src/components/dashboard-renderer/dashboard.canvas.tsx#EmbeddedDashboard",
  );
  const widget = preview.getByRole("article", { name: "Build history", exact: true });
  await expect(widget.getByLabel("Build count with a release marker")).toBeVisible();
  const toolbar = preview.getByRole("toolbar", { name: "Build history controls" });
  const marker = widget.getByRole("button", { name: "Release marker", exact: true });
  await marker.click();
  await expect(marker).toHaveAttribute("aria-pressed", "false");
  await toolbar.getByRole("button", { name: "Edit dashboard", exact: true }).click();
  await expect(marker).toHaveAttribute("aria-pressed", "false");
  await toolbar.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(marker).toHaveAttribute("aria-pressed", "false");
  await toolbar.getByRole("button", { name: "Edit dashboard", exact: true }).click();
  await toolbar.getByRole("button", { name: "Add widget", exact: true }).click();
  await preview.getByRole("menuitemradio", { name: "Custom", exact: true }).click();
  const settings = preview.getByRole("dialog", { name: "Widget settings" });
  await settings.getByRole("textbox", { name: "Title" }).fill("Additional build history");
  await page.keyboard.press("Escape");
  await toolbar.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(toolbar.getByRole("button", { name: "Edit dashboard", exact: true })).toBeFocused();
  await expect(marker).toHaveAttribute("aria-pressed", "false");
  await expect(preview.getByRole("article", { name: "Additional build history", exact: true })).toBeVisible();
});

// Critical: controlled layout edits must survive live data refresh and failed saves, and Cancel must not publish them.
test("apply and cancel dashboard edits through the caller-owned definition", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const preview = await openCanvasPreview(
    page,
    "packages/ui/src/components/dashboard-renderer/dashboard.canvas.tsx#Dashboard",
  );
  const chooseBehavior = async (name: string) => {
    await preview.getByRole("button", { name: /^(Editable|Save failure)$/ }).click();
    await preview.getByRole("menuitemradio", { name, exact: true }).click();
  };
  await preview.getByRole("button", { name: "Edit dashboard", exact: true }).click();
  const metric = preview.locator('[data-widget-id="conversations"]');
  await expect(metric.getByRole("list", { name: "Agent conversations daily values", exact: true })).toContainText(
    "Nov 6: Conversations, 34",
  );
  await metric.hover();
  await metric.getByRole("button", { name: "Configure Agent conversations", exact: true }).click();
  const settings = preview.getByRole("dialog", { name: "Widget settings", exact: true });
  await settings.getByRole("textbox", { name: "Title", exact: true }).fill("Weekly conversations");
  await settings.getByRole("textbox", { name: "Title", exact: true }).press("Escape");
  await expect(settings).toBeHidden();
  await preview.getByRole("button", { name: "Last 7 days", exact: true }).click();
  await preview.getByRole("menuitemradio", { name: "Last 3 days", exact: true }).click();
  await expect(metric.getByRole("heading", { name: "Weekly conversations", exact: true })).toBeVisible();
  await expect(metric.getByText("299", { exact: true })).toBeVisible();
  await chooseBehavior("Save failure");
  await preview.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(preview.getByRole("alert")).toBeVisible();
  await expect(metric.getByRole("heading", { name: "Weekly conversations", exact: true })).toBeVisible();
  await chooseBehavior("Editable");
  await preview.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(preview.getByRole("button", { name: "Edit dashboard", exact: true })).toBeFocused();
  await preview.getByRole("button", { name: "Edit dashboard", exact: true }).click();
  await metric.hover();
  await metric.getByRole("button", { name: "Configure Weekly conversations", exact: true }).click();
  await settings.getByRole("textbox", { name: "Title", exact: true }).fill("");
  await settings.getByRole("textbox", { name: "Title", exact: true }).press("Escape");
  await expect(settings).toBeHidden();
  await preview.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(metric.getByRole("heading", { name: "Weekly conversations", exact: true })).toBeVisible();
  await chooseBehavior("Read only");
  await expect(preview.getByRole("button", { name: "Edit dashboard", exact: true })).toHaveCount(0);
  await expect(metric.getByRole("heading", { name: "Weekly conversations", exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

// Critical: ending an edit must discard an in-progress resize and block its late pointer release.
test("Cancel cancels an active resize before its pointer is released", async ({ page }) => {
  const preview = await openCanvasPreview(
    page,
    "packages/ui/src/components/dashboard-renderer/dashboard.canvas.tsx#Dashboard",
  );
  await preview.getByRole("button", { name: "Edit dashboard", exact: true }).click();
  const metric = preview.locator('[data-widget-id="conversations"]');
  const width = () => metric.evaluate((element) => element.style.getPropertyValue("--dashboard-w"));
  const original = await width();
  await metric.hover();
  const handle = await metric
    .getByRole("button", { name: "Resize Agent conversations from right", exact: true })
    .boundingBox();
  await page.mouse.move(handle!.x + handle!.width / 2, handle!.y + handle!.height / 2);
  await page.mouse.down();
  await page.mouse.move(handle!.x + handle!.width / 2 + 100, handle!.y + handle!.height / 2, { steps: 8 });
  await expect.poll(width).not.toBe(original);
  const cancel = preview.getByRole("button", { name: "Cancel", exact: true });
  await cancel.focus();
  await cancel.press("Enter");
  await expect.poll(width).toBe(original);
  await expect(metric).toHaveAttribute("data-resizing", "false");
  const edit = preview.getByRole("button", { name: "Edit dashboard", exact: true });
  await edit.focus();
  await edit.press("Enter");
  await page.mouse.up();
  await expect.poll(width).toBe(original);
  await expect(metric).toHaveAttribute("data-resizing", "false");
});
