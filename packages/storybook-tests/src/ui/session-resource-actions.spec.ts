import { expect, test } from "@playwright/test";
import { getSharedStorybookBaseUrl } from "../scripts/storybook-server";

test("breadcrumb resource actions compose with contributed panel actions without duplicate commands", async ({
  page,
}) => {
  const baseUrl = getSharedStorybookBaseUrl("pstdio-workbench");
  await page.goto(
    `${baseUrl}/iframe.html?id=pstdio-workbench-reference-core-api-breadcrumb-actions--contributed-panel-actions`,
  );
  await page.getByRole("menuitem", { name: "Panel details", exact: true }).waitFor();
  await expect(page.getByRole("menuitem")).toHaveText(["Archive", "Panel details", "Copy link"]);
});
