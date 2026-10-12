import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { expect, test } from "@playwright/test";
import { folderProjectInput } from "../helpers/folder-project";
import { uiOrigin } from "../ui-server";

for (const action of ["rename", "delete"] as const) {
  test(`${action} acts on the artifact selected in the breadcrumb header`, async ({ page, request }) => {
    const root = resolve(import.meta.dirname, "../../../../__test-tmp__");
    mkdirSync(root, { recursive: true });
    const repo = mkdtempSync(join(root, "artifact-actions-"));
    execFileSync("git", ["init", "--quiet", repo]);
    const response = await request.post(`${uiOrigin}/v1/projects`, {
      data: folderProjectInput({ name: "Artifact header actions" }, repo),
    });
    expect(response.ok()).toBe(true);
    const project = (await response.json()) as { id: string };
    const extensionId = "pstdio.pstdio-artifacts";
    const execute = async (command: string, params: Record<string, unknown>) => {
      const response = await request.post(
        `${uiOrigin}/v1/projects/${project.id}/extensions/commands/${extensionId}.command.${command}/execute`,
        {
          data: { params, source: "api" },
        },
      );
      expect(response.ok()).toBe(true);
      const result = await response.json();
      expect(result.outcome.status, result.outcome.reason).toBe("success");
      return result.outcome.value;
    };
    try {
      writeFileSync(join(repo, "page.html"), "<title>Release report</title><h1>Report</h1>");
      const artifact = await execute("publish", { file_path: "page.html" });
      writeFileSync(join(repo, "page.html"), "<title>Reference page</title><h1>Reference</h1>");
      const reference = await execute("publish", { file_path: "page.html" });
      await page.addInitScript(() => localStorage.setItem("onboarding-complete", "true"));
      await page.goto(`/projects/${project.id}/extensions/${extensionId}/artifacts`);
      const frame = page.frameLocator('iframe[title="Artifacts"]:visible').last();
      await frame.getByRole("button", { name: "Release report", exact: true }).click();
      const menu = page.locator("[data-workbench-breadcrumb-resource-actions]");
      await menu.click();
      const label = action === "rename" ? "Rename artifact…" : "Delete artifact…";
      await page.getByRole("menuitem", { name: label, exact: true }).click();
      const dialog = page.getByRole("dialog");
      if (action === "rename") {
        const name = dialog.getByRole("textbox", { name: "Artifact name" });
        await expect(name).toHaveValue("Release report");
        await name.fill("Launch plan");
        await dialog.getByRole("button", { name: "Run", exact: true }).click();
        await expect(page.getByRole("tab", { name: "Launch plan", exact: true })).toBeVisible();
        await expect(menu).toHaveAttribute("aria-label", "Actions for Launch plan");
        expect(
          (await execute("list", {})).find((item: { artifactId: string }) => item.artifactId === artifact.artifactId)
            .title,
        ).toBe("Launch plan");
      } else {
        await expect(dialog).toBeVisible();
        expect(await execute("list", {})).toHaveLength(2);
        await dialog.getByRole("button", { name: "Delete", exact: true }).click();
        await expect(page.getByRole("tab", { name: "Release report", exact: true })).toHaveCount(0);
        await expect(frame.getByRole("button", { name: "Reference page", exact: true })).toBeVisible();
        expect((await execute("list", {})).map((item: { artifactId: string }) => item.artifactId)).toEqual([
          reference.artifactId,
        ]);
      }
    } finally {
      await request.delete(`${uiOrigin}/v1/projects/${project.id}`);
      rmSync(repo, { recursive: true, force: true });
    }
  });
}
