import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { expect, test } from "@playwright/test";
import { folderProjectInput } from "../helpers/folder-project";
import { uiOrigin } from "../ui-server";

test("finds published artifacts as resources and opens the latest version", async ({ page, request }) => {
  const root = resolve(import.meta.dirname, "../../../../__test-tmp__");
  mkdirSync(root, { recursive: true });
  const repo = mkdtempSync(join(root, "artifact-resources-"));
  execFileSync("git", ["init", "--quiet", repo]);
  const created = await request.post(`${uiOrigin}/v1/projects`, {
    data: folderProjectInput({ name: "Artifact resource search" }, repo),
  });
  expect(created.ok()).toBe(true);
  const project = (await created.json()) as { id: string };
  const extensionId = "pstdio.pstdio-artifacts";
  const execute = async (command: string, params: Record<string, unknown>) => {
    const response = await request.post(
      `${uiOrigin}/v1/projects/${project.id}/extensions/commands/${extensionId}.command.${command}/execute`,
      { data: { params, source: "api" } },
    );
    expect(response.ok()).toBe(true);
    const result = await response.json();
    expect(result.outcome.status, result.outcome.reason).toBe("success");
    return result.outcome.value;
  };
  try {
    writeFileSync(join(repo, "page.html"), "<title>Launch report draft</title><h1>Draft</h1>");
    const first = await execute("publish", { file_path: "page.html" });
    writeFileSync(join(repo, "page.html"), "<title>Launch report</title><h1>Latest report</h1>");
    await execute("publish", { file_path: "page.html", url: first.url });
    await page.addInitScript(() => localStorage.setItem("onboarding-complete", "true"));
    await page.goto(`/projects/${project.id}/extensions/${extensionId}/artifacts`);
    await page.getByRole("option", { name: "Search", exact: true }).click();
    const palette = page.getByRole("dialog");
    await palette.getByRole("textbox").fill("Launch report");
    const result = palette.getByText("Launch report", { exact: true });
    await expect(result).toHaveCount(1);
    await result.click();
    await expect(page.getByRole("tab", { name: "Launch report", exact: true })).toBeVisible();
    const frame = page.frameLocator('iframe[title="Artifacts"]:visible').last();
    const preview = frame.frameLocator('iframe[title^="Preview: "]').frameLocator("iframe");
    await expect(preview.getByRole("heading", { name: "Latest report" })).toBeVisible();
    await page.keyboard.press("ControlOrMeta+KeyP");
    await palette.getByRole("textbox").fill("Launch report");
    await execute("rename", { url: first.url, name: "Release plan" });
    await expect(palette.getByText("Launch report", { exact: true })).toHaveCount(0);
    await palette.getByRole("textbox").fill("Release plan");
    await expect(palette.getByText("Release plan", { exact: true })).toBeVisible();
    await execute("delete", { url: first.url });
    await expect(palette.getByText("Release plan", { exact: true })).toHaveCount(0);
  } finally {
    await request.delete(`${uiOrigin}/v1/projects/${project.id}`);
    rmSync(repo, { recursive: true, force: true });
  }
});
