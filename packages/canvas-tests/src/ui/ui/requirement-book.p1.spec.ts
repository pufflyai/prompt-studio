import { expect, test } from "@playwright/test";
import { openCanvasPreview } from "../preview";

const frame = "packages/ui/src/proposals/PS-104/requirement-book.canvas.tsx#Documentation";
test.use({ viewport: { width: 1600, height: 1000 } });

// Critical: local review and branch application must never replace accepted repository intent.
test("suggestion review blocks stale application and preserves the accepted revision", async ({ page }) => {
  const preview = await openCanvasPreview(page, frame);
  await preview.getByText("Suggestions", { exact: true }).click();
  await preview.getByRole("button", { name: "Review changes", exact: true }).press("Enter");
  const apply = preview.getByRole("button", { name: "Apply to working branch (demo)", exact: true });
  await expect(apply).toBeEnabled();
  await preview.getByRole("button", { name: "Mark reviewed", exact: true }).click();
  await preview.getByRole("button", { name: "Change target (demo)", exact: true }).click();
  await expect(apply).toBeDisabled();
  await expect(preview.getByText("Reconciliation required", { exact: true })).toBeVisible();
  await preview.getByRole("button", { name: "Use proposed content against current", exact: true }).click();
  await expect(preview.getByRole("button", { name: "Mark reviewed", exact: true })).toBeEnabled();
  await apply.click();
  await expect(preview.getByText("Prototype branch updated", { exact: true })).toBeVisible();
  await preview.getByRole("button", { name: "Book revision", exact: true }).press("Enter");
  await preview.getByRole("button", { name: "working branch · proposed edits", exact: true }).click();
  await preview.getByText("RB11 Notes", { exact: true }).click();
  await expect(
    preview.getByText(
      "Keep local editing responsive while saving work. Choose and review the persistence policy explicitly.",
      { exact: true },
    ),
  ).toBeVisible();
  await preview.getByRole("button", { name: "Book revision", exact: true }).press("Enter");
  await preview.getByRole("button", { name: "main · accepted intent", exact: true }).click();
  await expect(
    preview.getByText(
      "Keep local editing responsive while saving work. Choose and review the persistence policy explicitly.",
      { exact: true },
    ),
  ).toHaveCount(0);
  await preview.getByRole("button", { name: "Edit rule", exact: true }).click();
  await expect(preview.getByRole("button", { name: "Book revision", exact: true })).toContainText("working branch");
  await expect(preview.getByRole("textbox", { name: "Requirement", exact: true })).toHaveValue(
    "Keep local editing responsive while saving work. Choose and review the persistence policy explicitly.",
  );
});

// Critical: mapping must retain evidence and its qualifications without accepting a requirement.
test("mapped evidence stays accessible and returns to Undocumented after unmapping", async ({ page }) => {
  const preview = await openCanvasPreview(page, frame);
  await preview.getByText("Undocumented", { exact: true }).click();
  await preview.getByRole("button", { name: "Map to requirement", exact: true }).press("Enter");
  await preview.getByPlaceholder("Find a requirement…").fill("RB 19.A.1");
  await preview.getByRole("menuitem", { name: /^RB 19.A.1 / }).click();
  await expect(preview.getByText("Evidence · O-1", { exact: true })).toBeVisible();
  await expect(
    preview.getByText(
      "No executed result is attached. This is not an accepted product budget or a compliance verdict.",
      { exact: true },
    ),
  ).toBeVisible();
  await preview.getByRole("button", { name: "Map to another requirement", exact: true }).click();
  await preview.getByPlaceholder("Find another requirement…").fill("RB 8.A.2");
  await preview.getByRole("menuitem", { name: /^RB 8.A.2 / }).click();
  await expect(preview.getByText("Evidence · O-1", { exact: true })).toBeVisible();
  await preview.getByRole("button", { name: "Remove mapping", exact: true }).click();
  await preview.getByText("Undocumented", { exact: true }).click();
  await expect(preview.getByRole("heading", { name: "Page opening has a 200 ms assertion", exact: true })).toHaveCount(
    0,
  );
  await preview.getByText("RB19 Performance", { exact: true }).click();
  await preview.getByRole("button", { name: "Remove mapping", exact: true }).click();
  await preview.getByText("Undocumented", { exact: true }).click();
  await expect(
    preview.getByRole("heading", { name: "Page opening has a 200 ms assertion", exact: true }),
  ).toBeVisible();
});
