import { expect, type Page, test } from "@playwright/test";
import { openCanvasPreview } from "../preview";

test("edits widget descriptions and chooses colors for individual chart series", async ({ page }) => {
  const preview = await openCanvasPreview(
    page,
    "packages/ui/src/components/dashboard-renderer/dashboard.canvas.tsx#Dashboard",
  );
  await preview.getByRole("button", { name: "Edit dashboard", exact: true }).click();
  const metric = preview.getByRole("article", { name: "Agent conversations", exact: true });
  await metric.hover();
  await metric.getByRole("button", { name: "Configure Agent conversations", exact: true }).click();
  const settings = preview.getByRole("dialog", { name: "Widget settings" });
  await settings.getByRole("textbox", { name: "Description", exact: true }).fill("Activity in the selected period");
  await settings.getByRole("button", { name: /^Sparkline color:/ }).click();
  await preview.getByRole("menuitemradio", { name: "Purple", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(metric.getByText("Activity in the selected period", { exact: true })).toBeVisible();
  const volume = preview.getByRole("article", { name: "Conversation volume", exact: true });
  await volume.hover();
  await volume.getByRole("button", { name: "Configure Conversation volume", exact: true }).click();
  await settings.getByRole("button", { name: "Series Notebook", exact: true }).click();
  await settings.getByRole("menuitem", { name: "Threads", exact: true }).click();
  await settings.getByRole("button", { name: /^Series color:/ }).click();
  await preview.getByRole("menuitemradio", { name: "Teal", exact: true }).click();
  await page.keyboard.press("Escape");
  await preview.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(volume.locator('svg [fill="var(--chakra-colors-teal-500)"]').first()).toBeAttached();
  await expect(metric.locator('svg [stroke="var(--chakra-colors-purple-500)"]').first()).toBeAttached();
  await expect(metric.getByText("Activity in the selected period", { exact: true })).toBeVisible();
  await preview.getByRole("button", { name: "Edit dashboard", exact: true }).click();
  await metric.hover();
  await metric.getByRole("button", { name: "Configure Agent conversations", exact: true }).click();
  await settings.getByRole("button", { name: /^Sparkline color:/ }).click();
  await preview.getByRole("menuitemradio", { name: "Default", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(metric.locator('svg [stroke="var(--chakra-colors-purple-500)"]')).toHaveCount(0);
  await preview.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(metric.locator('svg [stroke="var(--chakra-colors-purple-500)"]').first()).toBeAttached();
});

// Critical: two distinct groups must have independently editable chart marks.
test("chooses independent stacked bar colors for named and ungrouped values", async ({ page }) => {
  const preview = await openCanvasPreview(
    page,
    "packages/ui/src/components/dashboard-renderer/dashboard.canvas.tsx#GroupedBarColors",
  );
  const widget = preview.getByRole("article", { name: "Grouped bars", exact: true });
  await expect(widget).toBeVisible();
  await preview.getByRole("button", { name: "Edit dashboard", exact: true }).click();
  await widget.hover();
  await widget.getByRole("button", { name: "Configure Grouped bars", exact: true }).click();
  const settings = preview.getByRole("dialog", { name: "Widget settings" });
  await settings.getByRole("button", { name: "Series Unassigned", exact: true }).click();
  await settings.getByRole("menuitem", { name: "Unassigned (3)", exact: true }).click();
  await settings.getByRole("button", { name: /^Series color:/ }).click();
  await preview.getByRole("menuitemradio", { name: "Purple", exact: true }).click();
  await settings.getByRole("button", { name: "Series Unassigned (3)", exact: true }).click();
  await settings.getByRole("menuitem", { name: "Unassigned", exact: true }).click();
  await settings.getByRole("button", { name: /^Series color:/ }).click();
  await preview.getByRole("menuitemradio", { name: "Teal", exact: true }).click();
  await page.keyboard.press("Escape");
  await preview.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(widget.locator('svg [fill="var(--chakra-colors-purple-500)"]').first()).toBeAttached();
  await expect(widget.locator('svg [fill="var(--chakra-colors-teal-500)"]').first()).toBeAttached();
});

test("offers the sole Data option only when it would replace the current source", async ({ page }) => {
  const preview = await openCanvasPreview(
    page,
    "packages/ui/src/components/dashboard-renderer/dashboard.canvas.tsx#WidgetSourceChoices",
  );
  const selected = preview.getByRole("article", { name: "Selected source", exact: true });
  const missing = preview.getByRole("article", { name: "Missing source", exact: true });
  const settings = preview.getByRole("dialog", { name: "Widget settings" });
  await preview.getByRole("button", { name: "Edit dashboard", exact: true }).click();
  await selected.hover();
  await selected.getByRole("button", { name: "Configure Selected source", exact: true }).click();
  await expect(settings.getByRole("button", { name: "Data Build status", exact: true })).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(settings).toBeHidden();
  await missing.hover();
  await missing.getByRole("button", { name: "Configure Missing source", exact: true }).click();
  await settings.getByRole("button", { name: /^Data / }).click();
  await settings.getByRole("menuitem", { name: "Build status", exact: true }).click();
  await expect(settings.getByRole("button", { name: "Data Build status", exact: true })).toBeDisabled();
  await page.keyboard.press("Escape");
  await preview.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(missing.getByText("Build passed", { exact: true })).toBeVisible();
});

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
  const dragPreview = preview.locator("[data-dashboard-drag-bubble]");
  await widget.getByRole("button", { name: "Drag Build history", exact: true }).press("Space");
  await expect(dragPreview).toHaveText("Build history");
  // The keyboard sensor registers its document listener on the next browser task.
  await dragPreview.evaluate(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));
  await page.keyboard.press("Escape");
  await expect(dragPreview).toBeHidden();
  await toolbar.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(marker).toHaveAttribute("aria-pressed", "false");
  await toolbar.getByRole("button", { name: "Edit dashboard", exact: true }).click();
  const controls = toolbar.getByRole("group", { name: "Dashboard controls" }).getByRole("button");
  await expect(controls.nth(-2)).toHaveAccessibleName("Cancel");
  await expect(controls.last()).toHaveAccessibleName("Apply");
  await toolbar.getByRole("button", { name: "Add widget", exact: true }).click();
  await preview.getByRole("menuitemradio", { name: "Custom", exact: true }).click();
  const settings = preview.getByRole("dialog", { name: "Widget settings" });
  const title = settings.getByRole("textbox", { name: "Title", exact: true });
  const description = settings.getByRole("textbox", { name: "Description", exact: true });
  await expect(title).toHaveValue("Build history");
  await expect(description).toHaveValue("Builds per day");
  await settings.getByRole("button", { name: "Data Build history", exact: true }).click();
  await preview.getByRole("menuitem", { name: "Release builds", exact: true }).click();
  await expect(title).toHaveValue("Release builds");
  await expect(description).toHaveValue("Builds per release");
  await title.fill("Additional build history");
  await description.fill("Additional description");
  await settings.getByRole("button", { name: "Data Release builds", exact: true }).click();
  await preview.getByRole("menuitem", { name: "Build history", exact: true }).click();
  await expect(title).toHaveValue("Additional build history");
  await expect(description).toHaveValue("Additional description");
  await page.keyboard.press("Escape");
  await toolbar.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(toolbar.getByRole("button", { name: "Edit dashboard", exact: true })).toBeFocused();
  await expect(marker).toHaveAttribute("aria-pressed", "false");
  const added = preview.getByRole("article", { name: "Additional build history", exact: true });
  await expect(added.getByRole("heading", { name: "Additional build history", exact: true })).toBeVisible();
  await expect(added.getByText("Additional description", { exact: true })).toBeVisible();
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

async function openDelayedDashboardSave(page: Page) {
  const preview = await openCanvasPreview(
    page,
    "packages/ui/src/components/dashboard-renderer/dashboard.canvas.tsx#DelayedDashboardSave",
  );
  const widget = preview.locator('[data-widget-id="releases"]');
  const toolbar = preview.getByRole("toolbar", { name: "Build history controls" });
  const edit = toolbar.getByRole("button", { name: "Edit dashboard", exact: true });
  const apply = toolbar.getByRole("button", { name: "Apply", exact: true });
  const complete = toolbar.getByRole("button", { name: "Complete save", exact: true });
  const refresh = toolbar.getByRole("button", { name: "Refresh saved dashboard", exact: true });
  const publishCorrection = toolbar.getByRole("button", { name: "Publish corrected dashboard", exact: true });
  const releaseMarker = widget.getByRole("button", { name: "Release marker", exact: true });
  const deploymentMarker = widget.getByRole("button", { name: "Deployment marker", exact: true });
  const configureWidget = async (current: string) => {
    await edit.click();
    await widget.hover();
    await widget.getByRole("button", { name: `Configure ${current}`, exact: true }).click();
    return preview.getByRole("dialog", { name: "Widget settings" });
  };
  const selectSource = async (current: string, next: string, title?: string) => {
    const settings = await configureWidget(current);
    if (title) await settings.getByRole("textbox", { name: "Title", exact: true }).fill(title);
    await settings.getByRole("button", { name: `Data ${current}`, exact: true }).click();
    await preview.getByRole("menuitem", { name: next, exact: true }).click();
    await page.keyboard.press("Escape");
  };
  const save = async () => {
    await apply.click();
    await complete.click();
    await expect(edit).toBeFocused();
  };
  return {
    preview,
    widget,
    edit,
    apply,
    complete,
    refresh,
    publishCorrection,
    releaseMarker,
    deploymentMarker,
    configureWidget,
    selectSource,
    save,
    publishSave: (id: number) => toolbar.getByRole("button", { name: `Publish save ${id}`, exact: true }),
  };
}

// Critical: each successful save must show the latest widget controls while the caller refreshes its definition.
test("keeps the latest applied custom preview across delayed controlled refreshes", async ({ page }) => {
  const { widget, refresh, releaseMarker, deploymentMarker, selectSource, save } = await openDelayedDashboardSave(page);
  await selectSource("Build history", "Deployment history");
  await deploymentMarker.click();
  await expect(deploymentMarker).toHaveAttribute("aria-pressed", "false");
  await save();
  await expect(deploymentMarker).toHaveAttribute("aria-pressed", "false");

  await selectSource("Deployment history", "Build history");
  await releaseMarker.click();
  await expect(releaseMarker).toHaveAttribute("aria-pressed", "false");
  await save();
  await expect(releaseMarker).toHaveAttribute("aria-pressed", "false");
  await expect(deploymentMarker).toHaveCount(0);

  await refresh.click();
  await expect(releaseMarker).toHaveAttribute("aria-pressed", "false");
  await selectSource("Build history", "Deployment history");
  await deploymentMarker.click();
  await save();
  await refresh.click();
  await expect(deploymentMarker).toHaveAttribute("aria-pressed", "false");
  await expect(widget.getByRole("button", { name: "Release marker", exact: true, includeHidden: true })).toHaveCount(0);
});

// Critical: refreshing a previous save while Apply is pending must preserve the newer widget's controls.
test("keeps the later applied widget when a previous save refreshes during Apply", async ({ page }) => {
  const { widget, edit, apply, complete, refresh, releaseMarker, deploymentMarker, selectSource, save } =
    await openDelayedDashboardSave(page);
  await selectSource("Build history", "Deployment history");
  await save();
  await expect(deploymentMarker).toBeVisible();

  const recentBuilds = widget.getByRole("article", { name: "Recent builds", exact: true });
  await selectSource("Deployment history", "Build history", "Recent builds");
  await releaseMarker.click();
  await apply.click();
  await expect(complete).toBeVisible();
  await refresh.click();
  await expect(refresh).toBeHidden();
  await expect(releaseMarker).toHaveAttribute("aria-pressed", "false");

  await complete.click();
  await expect(edit).toBeFocused();
  await expect(releaseMarker).toHaveAttribute("aria-pressed", "false");
  await expect(recentBuilds).toBeVisible();
  await expect(deploymentMarker).toHaveCount(0);
  await refresh.click();
  await expect(releaseMarker).toHaveAttribute("aria-pressed", "false");
  await expect(recentBuilds).toBeVisible();
});

// Critical: a caller that publishes multiple saves late or out of order must keep the latest widget visible.
test("keeps the latest custom widget through a chain of delayed saves", async ({ page }) => {
  const { widget, edit, apply, complete, refresh, releaseMarker, selectSource, configureWidget, save, publishSave } =
    await openDelayedDashboardSave(page);
  const rename = async (current: string, next: string) => {
    const settings = await configureWidget(current);
    const title = settings.getByRole("textbox", { name: "Title", exact: true });
    await title.fill(next);
    await title.press("Escape");
  };

  await selectSource("Build history", "Deployment history");
  await save();
  await selectSource("Deployment history", "Build history", "Second build");
  await save();

  await rename("Second build", "Third build");
  await releaseMarker.click();
  await apply.click();
  await expect(complete).toBeVisible();
  await publishSave(1).click();
  await expect(publishSave(1)).toBeHidden();
  await expect(releaseMarker).toHaveAttribute("aria-pressed", "false");
  await complete.click();
  await expect(edit).toBeFocused();
  await expect(widget.getByRole("article", { name: "Third build", exact: true })).toBeVisible();
  await expect(releaseMarker).toHaveAttribute("aria-pressed", "false");

  await rename("Third build", "Latest build");
  await save();
  const latest = widget.getByRole("article", { name: "Latest build", exact: true });
  for (const id of [3, 2]) {
    await publishSave(id).click();
    await expect(publishSave(id)).toBeHidden();
    await expect(latest).toBeVisible();
    await expect(releaseMarker).toHaveAttribute("aria-pressed", "false");
  }
  await refresh.click();
  await expect(latest).toBeVisible();
  await expect(releaseMarker).toHaveAttribute("aria-pressed", "false");
});

// Critical: description-only saves must remain visible while the caller refreshes.
test("keeps an applied widget description across a delayed controlled refresh", async ({ page }) => {
  const { preview, widget, edit, refresh, save } = await openDelayedDashboardSave(page);
  await edit.click();
  await widget.hover();
  await widget.getByRole("button", { name: "Configure Build history", exact: true }).click();
  await preview.getByRole("textbox", { name: "Description", exact: true }).fill("Builds and release markers");
  await page.keyboard.press("Escape");
  const description = widget.getByText("Builds and release markers", { exact: true });
  await save();
  await expect(description).toBeVisible();
  await refresh.click();
  await expect(description).toBeVisible();
});

// Critical: Apply must display a caller-corrected layout and use it as the starting point for the next edit.
test("uses the caller's corrected dashboard when it publishes before Apply completes", async ({ page }) => {
  const { widget, edit, apply, complete, refresh, publishCorrection, deploymentMarker, selectSource } =
    await openDelayedDashboardSave(page);
  const corrected = widget.getByRole("article", { name: "RECENT DEPLOYMENTS", exact: true });
  await selectSource("Build history", "Deployment history", "Recent deployments");
  await deploymentMarker.click();

  await apply.click();
  await publishCorrection.click();
  await expect(deploymentMarker).toHaveAttribute("aria-pressed", "false");
  await complete.click();
  await expect(edit).toBeFocused();
  await expect(corrected).toBeVisible();
  await expect(deploymentMarker).toHaveAttribute("aria-pressed", "false");

  await refresh.click();
  await expect(corrected).toBeVisible();
  await edit.click();
  await widget.hover();
  await expect(widget.getByRole("button", { name: "Configure RECENT DEPLOYMENTS", exact: true })).toBeVisible();
  await expect(deploymentMarker).toHaveAttribute("aria-pressed", "false");
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
