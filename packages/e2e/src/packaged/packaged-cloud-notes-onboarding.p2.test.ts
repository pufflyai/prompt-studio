import { test } from "bun:test";
import { join } from "node:path";
import { expect as browserExpect } from "@playwright/test";
import { waitForCloud, withCloudProject } from "./packaged-cloud-project.fixture";
import { signInBrowser } from "./packaged-serve-helpers";
import { setupPackagedSmokeTests } from "./packaged-smoke-setup";
import { PACKAGED_TEST_TIMEOUT } from "./packaged-test-timeout";

setupPackagedSmokeTests();
// Critical: a remote ready workspace must not prevent local folder setup or cold Notes creation.
test(
  "a downloaded cloud project opens Notes on this device and creates a note through its plus button",
  async () => {
    await withCloudProject("notes", async ({ b, project, page, sourceFolder, second, phase }) => {
      await signInBrowser(page, second.descriptor);
      await page
        .getByRole("dialog", { name: "Projects", exact: true })
        .getByRole("option", { name: "Cloud notes", exact: true })
        .click();
      await waitForCloud(async () => Boolean((await b.projects.folder(project.id)).path));
      phase("project folder opened; Notes navigation");
      const sidebar = page.locator('[data-workbench-region="sidenav"]');
      await sidebar.getByRole("option", { name: "Notes", exact: true }).click();
      await browserExpect(sidebar.getByRole("option", { name: "From device A", exact: true })).toBeVisible();
      await sidebar.getByRole("button", { name: "New note", exact: true }).click();
      phase("new note selected; await editor");
      const editor = page.getByTestId("content-editable").filter({ visible: true }).first();
      await browserExpect(editor).toBeVisible();
      phase("editor visible; fill note");
      await editor.fill("Created on device B");
      phase("editor filled; await sidebar title");
      await browserExpect(sidebar.getByRole("option", { name: "Created on device B", exact: true })).toBeVisible();
      phase("note authored; reload");
      await page.reload();
      await browserExpect(editor).toContainText("Created on device B");
      await waitForCloud(async () => {
        const files = new Bun.Glob("*/content.md").scan({
          cwd: join(sourceFolder, ".pstdio/extension-storage/pstdio.pstdio-notes/documents"),
        });
        for await (const file of files)
          if (
            (
              await Bun.file(join(sourceFolder, ".pstdio/extension-storage/pstdio.pstdio-notes/documents", file)).text()
            ).includes("Created on device B")
          )
            return true;
        return false;
      });
      await page.screenshot({ path: join(import.meta.dir, "../../test-results/cloud-notes-onboarding.png") });
    });
  },
  PACKAGED_TEST_TIMEOUT,
);
