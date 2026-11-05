import { expect, test } from "@playwright/test";
import { openCanvasPreview } from "../preview";

// Critical: switching sidebar tabs must preserve metadata access and the selected preview file.
test("skill Info and Files tabs preserve frontmatter metadata and the selected file", async ({ page }) => {
  const preview = await openCanvasPreview(
    page,
    "packages/pstdio-dashboard/src/modules/settings/components/skill-viewer.canvas.tsx#InstalledExtensionSkill",
  );
  await expect(preview.getByRole("tab", { name: "Info", exact: true })).toHaveAttribute("aria-selected", "true");
  const metadata = preview.getByTestId("project-skill-metadata");
  await expect(metadata).toContainText("Name: create-ticket");
  await expect(metadata).toContainText("Version: 1.2.0");
  await expect(metadata.getByTestId("project-skill-description")).toHaveText(
    "Create planner tickets from a short request, with a clear problem, expected behavior and validation steps.",
  );
  await preview.getByRole("tab", { name: "Files", exact: true }).click();
  await expect(metadata).toBeHidden();
  await preview.getByText("examples.md", { exact: true }).click();
  await expect(preview.getByRole("heading", { name: "Examples", exact: true })).toBeVisible();
  await preview.getByRole("tab", { name: "Info", exact: true }).click();
  await expect(metadata.getByTestId("project-skill-description")).toBeVisible();
  await expect(preview.getByRole("heading", { name: "Examples", exact: true })).toBeVisible();
});
