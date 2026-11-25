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
  const swatches = (plot: typeof scatterPlot) =>
    plot
      .locator(".ts-chart__legend text")
      .evaluateAll((labels) =>
        labels.map((label) => [label.textContent, getComputedStyle(label.previousElementSibling!).fill]),
      );
  expect(await swatches(scatterPlot)).toEqual(await swatches(ringPlot));
  await ringPlot.press("ArrowRight");
  await expect(preview.getByText(/^(40|60)%$/)).toBeVisible();
});

test("distinguishes ungrouped observations from caller-named groups", async ({ page }) => {
  const preview = await openCanvasPreview(
    page,
    "packages/ui/src/components/dashboard-renderer/dashboard.canvas.tsx#ChartEdgeCases",
  );
  const scatter = preview.getByRole("article", { name: "Scatter precision", exact: true });
  const legend = scatter.locator(".ts-chart__legend");
  for (const name of ["Unassigned", "0", "No group", "No group (2)", "No group (3)"]) {
    await expect(legend.getByText(name, { exact: true })).toBeVisible();
  }
});

test("reports distinct small coordinates during keyboard navigation", async ({ page }) => {
  const preview = await openCanvasPreview(
    page,
    "packages/ui/src/components/dashboard-renderer/dashboard.canvas.tsx#ChartEdgeCases",
  );
  const scatter = preview.getByRole("img", { name: "Scatter precision", exact: true });
  await scatter.press("Home");
  await expect(preview.getByText("Open intake", { exact: true })).toBeVisible();
  await expect(preview.getByText("0.0001", { exact: true })).toBeVisible();
  await scatter.press("ArrowRight");
  await expect(preview.getByText("Quick check", { exact: true })).toBeVisible();
  await expect(preview.getByText("0.0003", { exact: true })).toBeVisible();
});

test("shows a small ring value alongside its share", async ({ page }) => {
  const preview = await openCanvasPreview(
    page,
    "packages/ui/src/components/dashboard-renderer/dashboard.canvas.tsx#ChartEdgeCases",
  );
  const ring = preview.getByRole("img", { name: "Ring precision", exact: true });
  await ring.press("Home");
  await ring.press("ArrowRight");
  await expect(preview.getByText("40%", { exact: true })).toBeVisible();
  await expect(preview.getByText("0.0004", { exact: true })).toBeVisible();
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

// Critical: removing a card from a draft must preserve its controls if the edit is canceled.
test("cancel restores the state of a removed custom widget", async ({ page }) => {
  const preview = await openCanvasPreview(
    page,
    "packages/ui/src/components/dashboard-renderer/dashboard.canvas.tsx#EmbeddedDashboard",
  );
  const widget = preview.locator('[data-widget-id="releases"]');
  const toolbar = preview.getByRole("toolbar", { name: "Build history controls" });
  const edit = toolbar.getByRole("button", { name: "Edit dashboard", exact: true });
  const apply = toolbar.getByRole("button", { name: "Apply", exact: true });
  const marker = widget.getByRole("button", { name: "Release marker", exact: true });
  await marker.click();
  await expect(marker).toHaveAttribute("aria-pressed", "false");
  const removeWidget = async () => {
    await edit.click();
    await widget.hover();
    await widget.getByRole("button", { name: "Configure Build history", exact: true }).click();
    await preview.getByRole("button", { name: "Remove widget", exact: true }).click();
    await expect(apply).toBeFocused();
    await expect(widget).toBeHidden();
    await expect(preview.getByText("No widgets", { exact: true })).toBeVisible();
  };
  await removeWidget();
  await toolbar.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(marker).toHaveAttribute("aria-pressed", "false");
  await removeWidget();
  await expect(widget.getByRole("button", { name: "Release marker", exact: true, includeHidden: true })).toHaveCount(1);
  await apply.click();
  await expect(edit).toBeFocused();
  await expect(widget).toHaveCount(0);
});

test("cancel restores custom content after previewing another widget type", async ({ page }) => {
  const preview = await openCanvasPreview(
    page,
    "packages/ui/src/components/dashboard-renderer/dashboard.canvas.tsx#EmbeddedDashboard",
  );
  const widget = preview.locator('[data-widget-id="releases"]');
  const toolbar = preview.getByRole("toolbar", { name: "Build history controls" });
  const marker = widget.getByRole("button", { name: "Release marker", exact: true });
  await marker.click();
  await expect(marker).toHaveAttribute("aria-pressed", "false");
  await toolbar.getByRole("button", { name: "Edit dashboard", exact: true }).click();
  await widget.hover();
  await widget.getByRole("button", { name: "Configure Build history", exact: true }).click();
  const settings = preview.getByRole("dialog", { name: "Widget settings" });
  await settings.getByRole("button", { name: "Type Custom", exact: true }).click();
  await preview.getByRole("menuitem", { name: "Metric", exact: true }).click();
  await expect(widget.getByText("7", { exact: true })).toBeVisible();
  await expect(marker).toBeHidden();
  await toolbar.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(marker).toHaveAttribute("aria-pressed", "false");
});

test("keeps the correct custom content state when canceling or applying a data source change", async ({ page }) => {
  const preview = await openCanvasPreview(
    page,
    "packages/ui/src/components/dashboard-renderer/dashboard.canvas.tsx#EmbeddedDashboard",
  );
  const widget = preview.locator('[data-widget-id="releases"]');
  const toolbar = preview.getByRole("toolbar", { name: "Build history controls" });
  const releaseMarker = widget.getByRole("button", { name: "Release marker", exact: true });
  const deploymentMarker = widget.getByRole("button", { name: "Deployment marker", exact: true });
  const selectDeployments = async () => {
    await toolbar.getByRole("button", { name: "Edit dashboard", exact: true }).click();
    await widget.hover();
    await widget.getByRole("button", { name: "Configure Build history", exact: true }).click();
    const settings = preview.getByRole("dialog", { name: "Widget settings" });
    await settings.getByRole("button", { name: "Data Build history", exact: true }).click();
    await preview.getByRole("menuitem", { name: "Deployment history", exact: true }).click();
    await expect(releaseMarker).toBeHidden();
    await expect(deploymentMarker).toHaveAttribute("aria-pressed", "true");
  };
  await releaseMarker.click();
  await expect(releaseMarker).toHaveAttribute("aria-pressed", "false");
  await selectDeployments();
  await toolbar.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(releaseMarker).toHaveAttribute("aria-pressed", "false");
  await expect(widget.getByRole("button", { name: "Deployment marker", includeHidden: true })).toHaveCount(0);
  await selectDeployments();
  await page.keyboard.press("Escape");
  await deploymentMarker.click();
  await expect(deploymentMarker).toHaveAttribute("aria-pressed", "false");
  await toolbar.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(toolbar.getByRole("button", { name: "Edit dashboard", exact: true })).toBeFocused();
  await expect(deploymentMarker).toHaveAttribute("aria-pressed", "false");
  await expect(widget.getByRole("button", { name: "Release marker", exact: true, includeHidden: true })).toHaveCount(0);
});

// Critical: a popover must stop receiving input as soon as its widget or source is hidden.
test("dismisses custom widget popovers when removal or a preview hides their owner", async ({ page }) => {
  const preview = await openCanvasPreview(
    page,
    "packages/ui/src/components/dashboard-renderer/dashboard.canvas.tsx#EmbeddedDashboard",
  );
  const widget = preview.locator('[data-widget-id="releases"]');
  const toolbar = preview.getByRole("toolbar", { name: "Build history controls" });
  const options = widget.getByRole("button", { name: "Release marker options", exact: true });
  const popover = preview.getByRole("dialog", { name: "Release marker options", exact: true });

  await widget.getByRole("button", { name: "Release marker", exact: true }).click();
  for (const change of ["remove", "type", "data"]) {
    await toolbar.getByRole("button", { name: "Edit dashboard", exact: true }).click();
    await options.click();
    await expect(popover.getByRole("button", { name: "Toggle release marker" })).toBeVisible();
    await widget.hover();
    await widget.getByRole("button", { name: "Configure Build history", exact: true }).click();
    const settings = preview.getByRole("dialog", { name: "Widget settings" });
    await expect(popover).toBeVisible();
    if (change === "remove") {
      await settings.getByRole("button", { name: "Remove widget", exact: true }).click();
    } else if (change === "type") {
      await settings.getByRole("button", { name: "Type Custom", exact: true }).click();
      await preview.getByRole("menuitem", { name: "Metric", exact: true }).click();
    } else {
      await settings.getByRole("button", { name: "Data Build history", exact: true }).click();
      await preview.getByRole("menuitem", { name: "Deployment history", exact: true }).click();
    }
    await expect(options).toBeHidden();
    await expect(popover).toBeHidden();
    await toolbar.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(options).toHaveAttribute("aria-expanded", "false");
    await expect(popover).toBeHidden();
    await expect(widget.getByRole("button", { name: "Release marker", exact: true })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  }
});

// Critical: saving before the caller publishes value must preserve the applied widget's controls.
test("keeps an applied custom preview across a delayed controlled refresh", async ({ page }) => {
  const preview = await openCanvasPreview(
    page,
    "packages/ui/src/components/dashboard-renderer/dashboard.canvas.tsx#DelayedDashboardSave",
  );
  const widget = preview.locator('[data-widget-id="releases"]');
  const toolbar = preview.getByRole("toolbar", { name: "Build history controls" });
  const edit = toolbar.getByRole("button", { name: "Edit dashboard", exact: true });
  await edit.click();
  await widget.hover();
  await widget.getByRole("button", { name: "Configure Build history", exact: true }).click();
  const settings = preview.getByRole("dialog", { name: "Widget settings" });
  await settings.getByRole("button", { name: "Data Build history", exact: true }).click();
  await preview.getByRole("menuitem", { name: "Deployment history", exact: true }).click();
  await page.keyboard.press("Escape");
  const marker = widget.getByRole("button", { name: "Deployment marker", exact: true });
  await marker.click();
  await expect(marker).toHaveAttribute("aria-pressed", "false");

  await toolbar.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(edit).toBeFocused();
  await expect(marker).toHaveAttribute("aria-pressed", "false");
  await toolbar.getByRole("button", { name: "Refresh saved dashboard", exact: true }).click();
  await expect(marker).toHaveAttribute("aria-pressed", "false");
  await expect(widget.getByRole("button", { name: "Release marker", exact: true, includeHidden: true })).toHaveCount(0);
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
