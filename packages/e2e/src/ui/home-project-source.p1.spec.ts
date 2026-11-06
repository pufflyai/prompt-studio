import { readFileSync, realpathSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import type { ListProjectExtensionsResponse } from "pstdio-api-contracts";
import { folderProjectInput } from "../helpers/folder-project";
import { homeFrame, homePage } from "../helpers/home-loading";

// Critical risk: changing one project's default Home must not change another project's Home.
test("projects own editable Home sources and keep their customizations through setup", async ({ page, request }) => {
  const [custom, original] = await Promise.all(
    ["Custom Home", "Default Home"].map(async (name) => {
      const input = folderProjectInput({ name });
      const response = await request.post("/v1/projects", { data: input });
      expect(response.status()).toBe(201);
      const project = (await response.json()) as { id: string };
      const listed = await request.get(`/v1/projects/${project.id}/extensions`);
      expect(listed.ok()).toBe(true);
      const { extensions } = (await listed.json()) as ListProjectExtensionsResponse;
      const home = extensions.find((extension) => extension.extensionId === "pstdio.pstdio-home")!;
      expect(home).toBeTruthy();
      expect(home.scope).toBe("repo");
      expect(home.sourcePath).toBe(
        join(realpathSync(input.initial_workspace.params.path), ".pstdio/extensions/pstdio-home"),
      );
      return { ...project, home };
    }),
  );
  const component = "src/components/start-about-panel.tsx";
  const originalSource = readFileSync(join(original.home.sourcePath, component), "utf8");
  const customizedSource = "export const StartAboutPanel = () => <p>Project-specific welcome notes</p>;\n";
  await page.goto(`/projects/${custom.id}`);
  await expect(homePage(page)).toBeVisible();
  writeFileSync(join(custom.home.sourcePath, component), customizedSource);
  await expect(homeFrame(page).getByText("Project-specific welcome notes", { exact: true })).toBeVisible();

  await page.goto(`/projects/${original.id}`);
  await expect(homePage(page)).toBeVisible();
  await expect(homeFrame(page).getByText("Project-specific welcome notes", { exact: true })).toHaveCount(0);
  expect(readFileSync(join(original.home.sourcePath, component), "utf8")).toBe(originalSource);

  const retried = await request.post(`/v1/projects/${custom.id}/retry-setup`);
  expect(retried.status()).toBe(200);
  expect((await retried.json()).setup_error).toBeNull();
  expect(readFileSync(join(custom.home.sourcePath, component), "utf8")).toBe(customizedSource);
  await page.goto(`/projects/${custom.id}/extensions/pstdio.pstdio-home/home`);
  await expect(homeFrame(page).getByText("Project-specific welcome notes", { exact: true })).toBeVisible();
  await page.reload();
  await expect(homeFrame(page).getByText("Project-specific welcome notes", { exact: true })).toBeVisible();

  expect(
    (await request.delete(`/v1/projects/${custom.id}/extensions/${custom.home.id}?deleteUserData=true`)).ok(),
  ).toBe(true);
  await page.goto(`/projects/${original.id}/extensions/pstdio.pstdio-home/home`);
  await expect(homePage(page)).toBeVisible();
  expect(readFileSync(join(original.home.sourcePath, component), "utf8")).toBe(originalSource);
});
