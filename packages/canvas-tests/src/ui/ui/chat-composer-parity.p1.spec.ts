import { expect, test } from "@playwright/test";
import { openCanvasPreview } from "../preview";

// Critical extraction parity: model and parameter menus stay compact and usable without replacing an unsent draft.
test("chat model and harness parameters retain the compact toolbar", async ({ page }, info) => {
  const preview = await openCanvasPreview(
    page,
    "packages/ui/src/components/param-editor/harness-composer-controls.canvas.tsx#CompactComposer",
  );
  const model = preview.getByRole("button", { name: "Select model", exact: true });
  const effort = preview.getByRole("button", { name: "Reasoning effort: Medium", exact: true });
  const modelBox = await model.boundingBox();
  const effortBox = await effort.boundingBox();
  expect(modelBox).not.toBeNull();
  expect(effortBox).not.toBeNull();
  expect(Math.abs(modelBox!.y - effortBox!.y)).toBeLessThan(1);
  await model.click();
  await preview.getByRole("menuitem", { name: "Opus", exact: true }).click();
  await expect(model).toContainText("Opus");
  await effort.click();
  await preview.getByRole("menuitemradio", { name: "High", exact: true }).click();
  await preview.getByRole("button", { name: "Reasoning effort: High", exact: true }).click();
  await preview.getByRole("menuitemradio", { name: "Medium", exact: true }).click();
  await expect(preview.getByRole("menu")).toBeHidden();
  await expect(effort).toBeVisible();
  await expect(preview.locator('[contenteditable="true"]')).toHaveText("Keep this draft");
  await preview.locator("body").screenshot({ path: info.outputPath("compact-composer.png") });
});

// Critical parity: existing workspace selection stays in its frame without replacing the unsent input.
test("existing workspace selection and extension harness icon retain composer parity", async ({ page }, info) => {
  const preview = await openCanvasPreview(
    page,
    "packages/pstdio-dashboard/src/shared/command-params/workspace-param-field.canvas.tsx#ComposerWorkspace",
  );
  await expect(preview.getByRole("button", { name: "Select device", exact: true })).toHaveCount(0);
  await preview.getByRole("button", { name: "Select workspace", exact: true }).click();
  await preview.getByRole("menuitem", { name: "Documentation", exact: true }).click();
  await expect(preview.getByRole("button", { name: "Open workspace", exact: true })).toHaveCount(0);
  await preview.getByRole("button", { name: "Select model", exact: true }).click();
  const harness = preview.getByRole("menuitem", { name: "Select harness", exact: true });
  await expect(harness.locator('img[src^="data:image/svg+xml;base64,"]')).toBeVisible();
  await preview.locator("body").press("Escape");
  await preview.getByRole("button", { name: "View saved session", exact: true }).click();
  await expect(preview.getByRole("button", { name: "Open workspace", exact: true })).toContainText("Documentation");
  await expect(preview.locator('[contenteditable="true"]')).toHaveText("Keep this draft");
  await preview.locator("body").screenshot({ path: info.outputPath("workspace-composer.png") });
});
