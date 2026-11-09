import { expect, test } from "@playwright/test";
import { folderProjectInput } from "../helpers/folder-project";

test("Marmalade shares property drafts while keeping native input undo and focused view shortcuts", async ({
  page,
  request,
}) => {
  const created = await request.post("/v1/projects", {
    data: folderProjectInput({ name: "Marmalade shared editing" }),
  });
  expect(created.ok()).toBe(true);
  const projectId = (await created.json()).id as string;
  const commands = new Map<string, number>();
  const releaseProperty = Promise.withResolvers<void>();
  page.on("request", (request) => {
    const id = /\/commands\/([^/]+)\/execute/.exec(request.url())?.[1];
    if (id) commands.set(id, (commands.get(id) ?? 0) + 1);
  });
  const reads = () => commands.get("pstdio.extension-lab.command.marmalade.session.read") ?? 0;
  try {
    await page.addInitScript(() => {
      if (window === window.top) localStorage.setItem("onboarding-complete", "true");
    });
    await page.goto(`/projects/${projectId}`);
    await page.getByRole("option", { name: "Marmalade", exact: true }).click();
    const inspector = page.frameLocator('iframe[title="Properties and layers"]');
    const canvas = page.frameLocator('iframe[title="Great Wave"]');
    const rail = page.frameLocator('iframe[title="Marmalade tools"]');
    const property = inspector.getByRole("textbox", { name: "Layer text", exact: true });
    await expect(property).toHaveValue("The Great Wave");
    expect(reads()).toBe(1);

    const title = canvas.getByRole("button", { name: "Canvas layer: Title", exact: true });
    await title.focus();
    await page.keyboard.press("h");
    await expect(rail.getByRole("button", { name: "Hand tool" })).toHaveAttribute("aria-pressed", "true");
    expect(reads()).toBe(1);
    await property.focus();
    await property.press("End");
    await property.pressSequentially("v");
    await expect(property).toHaveValue("The Great Wavev");
    await expect(canvas.getByText("The Great Wavev", { exact: true })).toBeVisible();
    await expect(rail.getByRole("button", { name: "Hand tool" })).toHaveAttribute("aria-pressed", "true");
    await property.press("ControlOrMeta+z");
    await expect(property).toHaveValue("The Great Wave");
    await expect(canvas.getByText("The Great Wave", { exact: true })).toBeVisible();
    await property.press("Escape");

    await property.fill("Cancelled draft");
    await expect(canvas.getByText("Cancelled draft", { exact: true })).toBeVisible();
    await property.press("Escape");
    await property.blur();
    await expect(canvas.getByText("The Great Wave", { exact: true })).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Undo", exact: true })).toBeDisabled();

    let heldProperty = false;
    await page.route("**/pstdio.extension-lab.command.marmalade.session.execute/execute", async (route) => {
      const action = route.request().postDataJSON()?.params?.action;
      if (action?.type === "text" && !heldProperty) {
        heldProperty = true;
        await releaseProperty.promise;
      }
      await route.continue();
    });
    await property.fill("Accepted property");
    await property.blur();
    await expect.poll(() => heldProperty).toBe(true);
    await expect(canvas.getByText("Accepted property", { exact: true })).toBeVisible();
    await title.focus();
    await page.keyboard.press("ControlOrMeta+z");
    releaseProperty.resolve();
    await expect(canvas.getByText("The Great Wave", { exact: true })).toBeVisible();
    await page.unroute("**/pstdio.extension-lab.command.marmalade.session.execute/execute");
    await property.focus();
    await property.press("End");
    await property.pressSequentially("v");
    await property.press("ControlOrMeta+z");
    await property.press("ControlOrMeta+Shift+z");
    await expect(property).toHaveValue("The Great Wavev");
    await expect(canvas.getByRole("button", { name: "Redo", exact: true })).toBeEnabled();
    await property.press("Escape");
    await property.blur();
    await expect(canvas.getByText("The Great Wave", { exact: true })).toBeVisible();
    await title.focus();
    await page.keyboard.press("ControlOrMeta+Shift+z");
    await expect(canvas.getByText("Accepted property", { exact: true })).toBeVisible();

    await property.fill("Preserved on selection change");
    const selected = await request.post(
      `/v1/projects/${projectId}/extensions/commands/pstdio.extension-lab.command.marmalade.edit/execute`,
      { data: { params: { action: { type: "select", ids: ["credit"] } } } },
    );
    expect(selected.ok()).toBe(true);
    await expect(canvas.getByText("Preserved on selection change", { exact: true })).toBeVisible();
    await page.reload();
    await expect(canvas.getByText("Preserved on selection change", { exact: true })).toBeVisible();
    await expect(rail.getByRole("button", { name: "Hand tool" })).toHaveAttribute("aria-pressed", "true");
    await expect(inspector.getByRole("option", { name: "Credit", exact: true })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  } finally {
    releaseProperty.resolve();
    await request.delete(`/v1/projects/${projectId}`);
  }
});
