import { type APIRequestContext, expect, test } from "@playwright/test";
import { folderProjectInput } from "../helpers/folder-project";

const edit = async (request: APIRequestContext, projectId: string, action: object) => {
  const response = await request.post(
    `/v1/projects/${projectId}/extensions/commands/pstdio.extension-lab.command.marmalade.edit/execute`,
    { data: { params: { action } } },
  );
  expect(response.ok()).toBe(true);
  const result = await response.json();
  expect(result.outcome.ok, JSON.stringify(result)).toBe(true);
  return result.outcome.value;
};

test("Marmalade shares layer edits across its views, public commands, and reopening", async ({ page, request }) => {
  let projectId = process.env.MARMALADE_PROJECT_ID;
  const ownProject = !projectId;
  if (!projectId) {
    const created = await request.post("/v1/projects", { data: folderProjectInput({ name: "Marmalade" }) });
    expect(created.ok()).toBe(true);
    projectId = (await created.json()).id as string;
  }
  try {
    await edit(request, projectId, { type: "reset" });
    await page.addInitScript(() => {
      if (window === window.top) localStorage.setItem("onboarding-complete", "true");
    });
    await page.goto(`/projects/${projectId}`);
    await page.getByRole("option", { name: "Marmalade", exact: true }).click();
    const inspector = page.frameLocator('iframe[title="Properties and layers"]');
    const canvas = page.frameLocator('iframe[title="Great Wave"]');
    const nav = page.frameLocator('iframe[title="Marmalade"]');
    const rail = page.frameLocator('iframe[title="Marmalade tools"]');
    // The first opening builds five webviews. Wait for mounting before exercising their UI.
    await inspector.getByText("Layers", { exact: true }).waitFor();
    const imageWidth = await canvas.locator("image").evaluate(async (element) => {
      const image = new Image();
      image.src = element.getAttribute("href") ?? "";
      await image.decode();
      return image.naturalWidth;
    });
    expect(imageWidth).toBeGreaterThan(0);
    const title = inspector.getByRole("option", { name: "Title", exact: true });
    await expect(title).toHaveAttribute("aria-selected", "true");
    await inspector.getByRole("button", { name: "Hide Great Wave", exact: true }).click();
    await expect(title).toHaveAttribute("aria-selected", "true");
    await expect(canvas.getByRole("button", { name: "Canvas layer: Great Wave", exact: true })).toHaveCount(0);
    await inspector.getByRole("button", { name: "Show Great Wave", exact: true }).click();
    await inspector.getByRole("textbox", { name: "Layer text" }).fill("");
    await inspector.getByRole("textbox", { name: "Layer text" }).pressSequentially("Ocean study");
    await inspector.getByRole("textbox", { name: "Layer text" }).blur();
    await expect(canvas.getByText("Ocean study", { exact: true })).toBeVisible();

    // A command can replace the focused property panel before its draft timer fires.
    await inspector.getByRole("textbox", { name: "Layer text" }).fill("Remote selection draft");
    await edit(request, projectId, { type: "select", ids: ["credit"] });
    await expect(canvas.getByText("Remote selection draft", { exact: true })).toBeVisible();
    await edit(request, projectId, { type: "select", ids: ["title"] });

    await inspector.getByRole("option", { name: "Credit", exact: true }).click({ modifiers: ["ControlOrMeta"] });
    await expect(title).toHaveAttribute("aria-selected", "true");
    await title.focus();
    await page.keyboard.press("Alt+ArrowDown");
    await expect(title).toBeFocused();
    const rows = inspector.locator("[data-tree-list-node-id]");
    await expect
      .poll(async () =>
        rows.evaluateAll((elements) => elements.map((element) => element.getAttribute("data-tree-list-node-id"))),
      )
      .toEqual(["caption", "card", "title", "credit", "reference", "artwork"]);

    await inspector.getByRole("option", { name: "Caption", exact: true }).click();
    await inspector.getByRole("button", { name: "Collapse group" }).click();
    await expect(inspector.getByRole("option", { name: "Caption", exact: true })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await inspector.getByRole("button", { name: "Expand group" }).click();
    await inspector.getByRole("button", { name: "Lock Caption", exact: true }).click();
    await title.click();
    await expect(inspector.getByRole("textbox", { name: "Layer text" })).toBeDisabled();
    await inspector.getByRole("button", { name: "Unlock Caption", exact: true }).click();
    await expect(inspector.getByRole("textbox", { name: "Layer text" })).toBeEnabled();
    await edit(request, projectId, { type: "text", id: "title", text: "Edited from a command" });
    await expect(inspector.getByRole("textbox", { name: "Layer text" })).toHaveValue("Edited from a command");
    // Restore paint order so the edited type sits above the caption card.
    await edit(request, projectId, { type: "select", ids: ["title", "credit"] });
    await edit(request, projectId, { type: "reorder", source: "title", target: "card", position: "before" });
    await expect(canvas.getByText("Edited from a command", { exact: true })).toBeVisible();
    await rail.getByRole("button", { name: "Hand tool" }).click();
    await expect(rail.getByRole("button", { name: "Hand tool" })).toHaveAttribute("aria-pressed", "true");
    await page.reload();
    await expect(inspector.getByRole("textbox", { name: "Layer text" })).toHaveValue("Edited from a command");
    await expect(canvas.getByText("Edited from a command", { exact: true })).toBeVisible();
    await test.info().attach("Marmalade", { body: await page.screenshot(), contentType: "image/png" });
    await nav.getByRole("button", { name: "New", exact: true }).click();
    await expect(inspector.getByText("No layers", { exact: true })).toBeVisible();
    await inspector.getByRole("button", { name: "Restore sample" }).click();
    await expect(title).toBeVisible();
  } finally {
    if (ownProject) await request.delete(`/v1/projects/${projectId}`);
  }
});

test("Marmalade pointer tools use document coordinates and layer controls do not drag", async ({ page, request }) => {
  let projectId = process.env.MARMALADE_PROJECT_ID;
  const ownProject = !projectId;
  if (!projectId) {
    const created = await request.post("/v1/projects", {
      data: folderProjectInput({ name: "Marmalade pointer tools" }),
    });
    expect(created.ok()).toBe(true);
    projectId = (await created.json()).id as string;
  }
  try {
    await edit(request, projectId, { type: "reset" });
    await edit(request, projectId, { type: "viewport", zoom: 0.5 });
    await page.addInitScript(() => {
      if (window === window.top) localStorage.setItem("onboarding-complete", "true");
    });
    await page.goto(`/projects/${projectId}`);
    await page.getByRole("option", { name: "Marmalade", exact: true }).click();
    const inspector = page.frameLocator('iframe[title="Properties and layers"]');
    const canvas = page.frameLocator('iframe[title="Great Wave"]');
    const rail = page.frameLocator('iframe[title="Marmalade tools"]');
    const layer = canvas.getByRole("button", { name: "Canvas layer: Title", exact: true });
    await layer.waitFor();
    const start = await layer.boundingBox();
    expect(start).not.toBeNull();
    const scale = await layer.evaluate((element) => (element as SVGGElement).getScreenCTM()!.a);
    await page.mouse.move(start!.x + 8, start!.y + 8);
    await page.mouse.down();
    await page.mouse.move(start!.x + 8 + scale * 40, start!.y + 8 + scale * 20, { steps: 5 });
    await page.mouse.up();
    await expect(inspector.getByRole("spinbutton", { name: "Layer X", exact: true })).toHaveValue("125");
    await expect(inspector.getByRole("spinbutton", { name: "Layer Y", exact: true })).toHaveValue("640");
    await rail.getByRole("button", { name: "Hand tool" }).click();
    await expect(rail.getByRole("button", { name: "Hand tool" })).toHaveAttribute("aria-pressed", "true");
    const outerScale = await canvas
      .locator('svg[aria-label="Marmalade document canvas"]')
      .evaluate((element) => (element as SVGSVGElement).getScreenCTM()!.a);
    const before = await layer.boundingBox();
    await page.mouse.move(before!.x + 8, before!.y + 8);
    await page.mouse.down();
    await page.mouse.move(before!.x + 8 + outerScale * 50, before!.y + 8, { steps: 5 });
    await page.mouse.up();
    await expect.poll(async () => (await layer.boundingBox())!.x - before!.x).toBeCloseTo(outerScale * 50, 0);

    const eye = inspector.getByRole("button", { name: "Hide Great Wave", exact: true });
    await eye.evaluate((element) => {
      element.ownerDocument.addEventListener("dragstart", (event) =>
        element.setAttribute("data-drag-started", String(event.target === element)),
      );
    });
    const button = await eye.boundingBox();
    await page.mouse.move(button!.x + button!.width / 2, button!.y + button!.height / 2);
    await page.mouse.down();
    await page.mouse.move(button!.x + 40, button!.y + 40, { steps: 5 });
    await page.mouse.up();
    await expect(eye).not.toHaveAttribute("data-drag-started");

    const title = inspector.getByRole("option", { name: "Title", exact: true });
    const target = inspector.getByRole("option", { name: "Great Wave", exact: true });
    await title.click();
    // The selected layer's properties push the layer list below the fold; scroll it like a user would.
    await target.scrollIntoViewIfNeeded();
    const sourceBounds = await title.boundingBox();
    const targetBounds = await target.boundingBox();
    await page.mouse.move(sourceBounds!.x + 85, sourceBounds!.y + sourceBounds!.height / 2);
    await page.mouse.down();
    await page.mouse.move(sourceBounds!.x + 100, sourceBounds!.y + sourceBounds!.height / 2 + 15);
    await page.mouse.move(targetBounds!.x + 85, targetBounds!.y + 2, { steps: 10 });
    await page.mouse.move(targetBounds!.x + 85, targetBounds!.y + 2);
    await expect(inspector.locator('[data-tree-list-drop-indicator="before"]')).toBeVisible();
    await page.mouse.up();
    await expect
      .poll(async () =>
        inspector
          .locator("[data-tree-list-node-id]")
          .evaluateAll((rows) => rows.map((row) => row.getAttribute("data-tree-list-node-id"))),
      )
      .toEqual(["caption", "credit", "card", "reference", "title", "artwork"]);
    await expect(title).toBeFocused();
    await inspector.getByRole("button", { name: "Lock Title", exact: true }).click();
    await expect(inspector.getByRole("spinbutton", { name: "Layer X", exact: true })).toBeDisabled();
    await inspector.getByRole("option", { name: "Credit", exact: true }).click({ modifiers: ["ControlOrMeta"] });
    await inspector.getByRole("option", { name: "Credit", exact: true }).focus();
    await page.keyboard.press("Alt+ArrowDown");
    await expect(inspector.getByRole("alert")).toHaveText("Title is locked or unavailable");
    await edit(request, projectId, { type: "select", ids: ["credit"] });
    const artwork = canvas.getByRole("button", { name: "Canvas layer: Great Wave", exact: true });
    await artwork.focus();
    await expect(artwork).toBeFocused();
    await edit(request, projectId, { type: "reorder", source: "credit", target: "artwork", position: "before" });
    await expect(inspector.getByRole("option", { name: "Credit", exact: true })).toHaveAttribute("aria-level", "1");
    await expect(artwork).toBeFocused();
    await test.info().attach("Marmalade pointer tools", { body: await page.screenshot(), contentType: "image/png" });
  } finally {
    if (ownProject) await request.delete(`/v1/projects/${projectId}`);
  }
});

test("Marmalade creates artwork, edits properties, groups layers, and shares undo history", async ({
  page,
  request,
}) => {
  let projectId = process.env.MARMALADE_PROJECT_ID;
  const ownProject = !projectId;
  if (!projectId) {
    const created = await request.post("/v1/projects", { data: folderProjectInput({ name: "Marmalade authoring" }) });
    expect(created.ok()).toBe(true);
    projectId = (await created.json()).id as string;
  }
  try {
    await edit(request, projectId, { type: "reset" });
    await page.addInitScript(() => {
      if (window === window.top) localStorage.setItem("onboarding-complete", "true");
    });
    await page.goto(`/projects/${projectId}`);
    await page.getByRole("option", { name: "Marmalade", exact: true }).click();
    const inspector = page.frameLocator('iframe[title="Properties and layers"]');
    const canvas = page.frameLocator('iframe[title="Great Wave"]');
    const rail = page.frameLocator('iframe[title="Marmalade tools"]');
    const drawing = canvas.locator('svg[aria-label="Marmalade document canvas"]');
    await drawing.waitFor();
    await rail.getByRole("button", { name: "Rectangle tool" }).click();
    await expect(rail.getByRole("button", { name: "Rectangle tool" })).toHaveAttribute("aria-pressed", "true");
    const bounds = await drawing.boundingBox();
    await page.mouse.move(bounds!.x + bounds!.width * 0.2, bounds!.y + bounds!.height * 0.3);
    await page.mouse.down();
    await page.mouse.move(bounds!.x + bounds!.width * 0.4, bounds!.y + bounds!.height * 0.45, { steps: 8 });
    await page.mouse.up();
    await expect(inspector.getByRole("option", { name: "Rectangle", exact: true })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await inspector.getByRole("spinbutton", { name: "Layer width", exact: true }).fill("260");
    await inspector.getByRole("spinbutton", { name: "Layer width", exact: true }).blur();
    await inspector.getByRole("spinbutton", { name: "Layer rotation", exact: true }).fill("25");
    await inspector.getByRole("spinbutton", { name: "Layer rotation", exact: true }).blur();
    await expect(canvas.getByRole("button", { name: "Canvas layer: Rectangle", exact: true })).toHaveAttribute(
      "transform",
      /rotate\(25 /,
    );
    await expect(
      canvas.getByRole("button", { name: "Canvas layer: Rectangle", exact: true }).locator("rect").first(),
    ).toHaveAttribute("width", "260");
    await inspector.getByRole("button", { name: "Duplicate layers", exact: true }).click();
    await expect(inspector.getByRole("option", { name: "Rectangle copy", exact: true })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await inspector.getByRole("option", { name: "Rectangle", exact: true }).click({ modifiers: ["ControlOrMeta"] });
    await inspector.getByRole("button", { name: "Group layers", exact: true }).click();
    await expect(inspector.getByRole("option", { name: "Group", exact: true })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await inspector.getByRole("button", { name: "Ungroup layers", exact: true }).click();
    await expect(inspector.getByRole("option", { name: "Group", exact: true })).toHaveCount(0);
    await inspector.getByRole("button", { name: "Delete layers", exact: true }).click();
    await expect(canvas.getByRole("button", { name: "Canvas layer: Rectangle", exact: true })).toHaveCount(0);
    await canvas.getByRole("button", { name: "Undo", exact: true }).click();
    await expect(canvas.getByRole("button", { name: "Canvas layer: Rectangle", exact: true })).toBeVisible();
    await canvas.getByRole("button", { name: "Redo", exact: true }).click();
    await expect(canvas.getByRole("button", { name: "Canvas layer: Rectangle", exact: true })).toHaveCount(0);

    await rail.getByRole("button", { name: "Brush tool" }).click();
    await expect(rail.getByRole("button", { name: "Brush tool" })).toHaveAttribute("aria-pressed", "true");
    await page.mouse.move(bounds!.x + 100, bounds!.y + 100);
    await page.mouse.down();
    await page.mouse.move(bounds!.x + 180, bounds!.y + 140, { steps: 6 });
    await page.mouse.move(bounds!.x + 240, bounds!.y + 110, { steps: 6 });
    await page.mouse.up();
    const stroke = canvas.getByRole("button", { name: "Canvas layer: Brush stroke", exact: true });
    await expect(stroke.locator("polyline")).toBeVisible();
    await inspector.getByRole("spinbutton", { name: "Layer stroke width" }).fill("16");
    await inspector.getByRole("spinbutton", { name: "Layer stroke width" }).blur();
    await expect(stroke.locator("polyline")).toHaveAttribute("stroke-width", "16");
    await stroke.focus();
    await page.keyboard.press("ControlOrMeta+z");
    await expect(stroke.locator("polyline")).toHaveAttribute("stroke-width", "8");
    await page.keyboard.press("ControlOrMeta+Shift+z");
    await expect(stroke.locator("polyline")).toHaveAttribute("stroke-width", "16");

    await inspector.getByRole("button", { name: "Add text layer", exact: true }).click();
    await inspector.getByRole("textbox", { name: "Layer text", exact: true }).fill("Marmalade studio");
    await inspector.getByRole("textbox", { name: "Layer text", exact: true }).blur();
    await inspector.getByRole("spinbutton", { name: "Layer font size", exact: true }).fill("64");
    await inspector.getByRole("spinbutton", { name: "Layer font size", exact: true }).blur();
    await expect(canvas.getByText("Marmalade studio", { exact: true })).toHaveCSS("font-size", "64px");
    await page.reload();
    await expect(canvas.getByText("Marmalade studio", { exact: true })).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Undo", exact: true })).toBeEnabled();
    await inspector.getByRole("option", { name: "Great Wave", exact: true }).click();
    const image = canvas.locator("image");
    const before = await image.screenshot();
    await inspector.getByRole("spinbutton", { name: "Layer saturation", exact: true }).fill("0");
    await inspector.getByRole("spinbutton", { name: "Layer saturation", exact: true }).blur();
    await expect(canvas.locator("feColorMatrix")).toHaveAttribute("values", "0");
    const after = await image.screenshot();
    expect(after.equals(before)).toBe(false);
    await inspector.getByRole("button", { name: "Reset adjustments", exact: true }).click();
    await expect(image).not.toHaveAttribute("filter");
    await page.setViewportSize({ width: 900, height: 900 });
    await expect(inspector.getByRole("spinbutton", { name: "Layer brightness", exact: true })).toBeVisible();
    await test.info().attach("Marmalade authoring", { body: await page.screenshot(), contentType: "image/png" });
  } finally {
    if (ownProject) await request.delete(`/v1/projects/${projectId}`);
  }
});

test("Marmalade draws ellipses and creates styled type directly on the canvas", async ({ page, request }) => {
  let projectId = process.env.MARMALADE_PROJECT_ID;
  const ownProject = !projectId;
  if (!projectId) {
    const created = await request.post("/v1/projects", {
      data: folderProjectInput({ name: "Marmalade type and shape" }),
    });
    expect(created.ok()).toBe(true);
    projectId = (await created.json()).id as string;
  }
  try {
    await edit(request, projectId, { type: "reset" });
    await page.addInitScript(() => {
      if (window === window.top) localStorage.setItem("onboarding-complete", "true");
    });
    await page.goto(`/projects/${projectId}`);
    await page.getByRole("option", { name: "Marmalade", exact: true }).click();
    const inspector = page.frameLocator('iframe[title="Properties and layers"]');
    const canvas = page.frameLocator('iframe[title="Great Wave"]');
    const rail = page.frameLocator('iframe[title="Marmalade tools"]');
    const drawing = canvas.locator('svg[aria-label="Marmalade document canvas"]');
    await drawing.waitFor();
    await rail.getByRole("button", { name: "Ellipse tool" }).click();
    await expect(rail.getByRole("button", { name: "Ellipse tool" })).toHaveAttribute("aria-pressed", "true");
    const bounds = await drawing.boundingBox();
    await page.mouse.move(bounds!.x + 100, bounds!.y + 100);
    await page.mouse.down();
    await page.mouse.move(bounds!.x + 260, bounds!.y + 220, { steps: 8 });
    await page.mouse.up();
    const ellipse = canvas.getByRole("button", { name: "Canvas layer: Ellipse", exact: true }).locator("ellipse");
    await expect(ellipse).toBeVisible();
    const color = inspector.locator('[data-scope="color-picker"][data-part="channel-input"]');
    await color.fill("#ff8800");
    await color.blur();
    await expect(ellipse).toHaveAttribute("fill", /#ff8800/i);
    await rail.getByRole("button", { name: "Text tool" }).click();
    await expect(rail.getByRole("button", { name: "Text tool" })).toHaveAttribute("aria-pressed", "true");
    await drawing.click({ position: { x: 300, y: 260 } });
    await expect(inspector.getByRole("option", { name: "Text", exact: true })).toHaveAttribute("aria-selected", "true");
    await inspector.getByRole("textbox", { name: "Layer text", exact: true }).fill("Brush and type");
    await inspector.getByRole("textbox", { name: "Layer text", exact: true }).blur();
    await expect(rail.getByRole("button", { name: "Text tool" })).toHaveAttribute("aria-pressed", "true");
    await inspector.getByRole("button", { name: "Regular", exact: true }).click();
    await inspector.getByRole("menuitemradio", { name: "Bold", exact: true }).click();
    await inspector.getByRole("button", { name: "Sans serif", exact: true }).click();
    await inspector.getByRole("menuitemradio", { name: "Serif", exact: true }).click();
    await inspector.getByRole("button", { name: "Left", exact: true }).click();
    await inspector.getByRole("menuitemradio", { name: "Center", exact: true }).click();
    const text = canvas.getByText("Brush and type", { exact: true });
    await expect(text).toHaveAttribute("font-weight", "700");
    await expect(text).toHaveAttribute("font-family", "serif");
    await expect(text).toHaveAttribute("text-anchor", "middle");
    await page.reload();
    await expect(text).toHaveAttribute("font-weight", "700");
    await expect(ellipse).toHaveAttribute("fill", /#ff8800/i);
  } finally {
    if (ownProject) await request.delete(`/v1/projects/${projectId}`);
  }
});
