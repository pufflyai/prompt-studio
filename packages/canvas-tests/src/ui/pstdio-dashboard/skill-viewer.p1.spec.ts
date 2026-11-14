import { expect, test } from "@playwright/test";
import { openCanvasPreview } from "../preview";

// Critical: hiding details must preserve the selected supporting file and allow recovery.
test("skill details combine metadata and files and reopen without losing the document", async ({ page }) => {
  const preview = await openCanvasPreview(
    page,
    "extensions/pstdio-skill-browser/src/skill-viewer.canvas.tsx#InstalledExtensionSkill",
  );
  const metadata = preview.getByTestId("project-skill-metadata");
  await expect(metadata).toContainText("create-ticket");
  await expect(metadata).toContainText("1.2.0");
  await expect(metadata.getByTestId("project-skill-description")).toHaveText(
    "Create planner tickets from a short request, with a clear problem, expected behavior and validation steps.",
  );
  await preview.getByText("examples.md", { exact: true }).click();
  await expect(preview.getByRole("heading", { name: "Examples", exact: true })).toBeVisible();
  await preview.getByRole("button", { name: "Close skill details", exact: true }).click();
  await expect(metadata).toBeHidden();
  await expect(preview.getByRole("heading", { name: "Examples", exact: true })).toBeVisible();
  await preview.getByRole("button", { name: "Show skill details", exact: true }).click();
  await expect(metadata).toBeVisible();
  await expect(preview.getByRole("heading", { name: "Examples", exact: true })).toBeVisible();
});
