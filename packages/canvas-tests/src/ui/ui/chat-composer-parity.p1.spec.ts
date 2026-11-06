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

// Critical risk: provider options must stay inside the workspace frame without replacing the unsent input.
test("workspace provider fields and extension harness icon remain usable in the composer frame", async ({
  page,
}, info) => {
  const preview = await openCanvasPreview(
    page,
    "packages/pstdio-dashboard/src/shared/command-params/workspace-param-field.canvas.tsx#ComposerWorkspace",
  );
  await expect(preview.getByText("Base branch", { exact: true })).toBeVisible();
  await preview.getByRole("button", { name: "Select model", exact: true }).click();
  const harness = preview.getByRole("menuitem", { name: "External harness", exact: true });
  await expect(harness.locator('img[src^="data:image/svg+xml;base64,"]')).toBeVisible();
  await preview.locator("body").press("Escape");
  await preview.getByRole("button", { name: "Create workspace", exact: true }).last().click();
  await expect(preview.getByText("Base branch", { exact: true })).toHaveCount(0);
  await expect(preview.locator('[contenteditable="true"]')).toHaveText("Keep this draft");
  await preview.locator("body").screenshot({ path: info.outputPath("workspace-composer.png") });
});
