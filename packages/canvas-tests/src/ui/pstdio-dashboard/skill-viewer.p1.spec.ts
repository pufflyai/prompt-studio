import { expect, test } from "@playwright/test";
import { openCanvasPreview } from "../preview";

// Critical: frontmatter metadata must remain available while navigating a skill's files.
test("skill sidebar shows frontmatter metadata above the files even with an empty catalog description", async ({
  page,
}) => {
  const preview = await openCanvasPreview(
    page,
    "packages/pstdio-dashboard/src/modules/settings/components/skill-viewer.canvas.tsx#InstalledExtensionSkill",
  );
  const metadata = preview.getByTestId("project-skill-metadata");
  await expect(metadata).toContainText("Name: create-ticket");
  await expect(metadata).toContainText("Version: 1.2.0");
  await expect(metadata.getByTestId("project-skill-description")).toHaveText(
    "Create planner tickets from a short request, with a clear problem, expected behavior and validation steps.",
  );
  await preview.getByText("examples.md", { exact: true }).click();
  await expect(preview.getByRole("heading", { name: "Examples", exact: true })).toBeVisible();
  await expect(metadata.getByTestId("project-skill-description")).toBeVisible();
});
