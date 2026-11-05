import { expect, test } from "@playwright/test";
import { folderProjectInput } from "../helpers/folder-project";
import { homePage } from "../helpers/home-loading";

// Creation remains recoverable in the picker; optional setup cannot appear before eligibility is known.
for (const ending of ["ready", "failed"] as const) {
  test(`waits for setup eligibility while project creation handles ${ending}`, async ({ page, request }) => {
    const projects = await Promise.all(
      ["Previous", "Created"].map(async (name) => {
        const response = await request.post("/v1/projects", { data: folderProjectInput({ name }) });
        expect(response.ok()).toBe(true);
        return response.json();
      }),
    );
    let creations = 0;
    const creation = { entered: Promise.withResolvers<void>(), release: Promise.withResolvers<void>() };
    await page.route("**/v1/projects", async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      creations++;
      creation.entered.resolve();
      await creation.release.promise;
      await route.fulfill(
        ending === "failed" && creations === 1
          ? { status: 500, json: { error: "Folder setup failed" } }
          : { status: 201, json: projects[1] },
      );
    });
    try {
      await page.goto(`/projects/${projects[0].id}`);
      await expect(homePage(page)).toBeVisible();
      const switcher = page.getByRole("button", { name: "Switch project", exact: true });
      if (await switcher.isVisible()) await switcher.click();
      await page.getByRole("button", { name: "Create project", exact: true }).click();
      const path = page.getByRole("textbox", { name: "Folder path", exact: true });
      await path.fill(folderProjectInput({}).initial_workspace.params.path);
      await path.press("Enter");
      await page.getByRole("button", { name: "Open folder", exact: true }).click();
      await creation.entered.promise;
      await expect(path).toBeVisible();
      await expect(page.getByRole("button", { name: "Open folder", exact: true })).toBeDisabled();
      creation.release.resolve();
      if (ending === "failed") {
        await expect(page.getByText("Folder setup failed", { exact: true })).toBeVisible();
        const retry = page.getByRole("button", { name: "Open folder", exact: true });
        await expect(retry).toBeEnabled();
        await retry.click();
        await expect(path).toHaveCount(0);
      } else {
        await expect(page.getByRole("textbox", { name: "Folder path", exact: true })).toHaveCount(0);
      }
      await expect(page.getByRole("dialog")).toHaveCount(0);
      expect(creations).toBe(ending === "failed" ? 2 : 1);
    } finally {
      creation.release.resolve();
    }
  });
}
