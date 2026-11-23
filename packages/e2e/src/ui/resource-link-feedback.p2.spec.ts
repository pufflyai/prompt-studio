import { rmSync } from "node:fs";
import { folderProjectInput } from "../helpers/folder-project";
import { expect, test } from "../scripts/session-test";
import { uiOrigin } from "../ui-server";
import { createGitRepo } from "./helpers/workspace-session-attempt";

test("a held link removal hides only its row and restores it after a rejection", async ({ page, request }) => {
  const repo = createGitRepo("pstdio-link-feedback-", "Resource link feedback");
  const release = Promise.withResolvers<void>();
  const intercepted = Promise.withResolvers<string>();
  let projectId: string | undefined;
  try {
    const created = await request.post(`${uiOrigin}/v1/projects`, { data: folderProjectInput({}, repo) });
    expect(created.ok()).toBe(true);
    projectId = (await created.json()).id as string;
    const sessionRef = async (title: string) => {
      const response = await request.post(`${uiOrigin}/v1/sessions`, {
        data: { project_id: projectId, agent: "pstdio.workbench-fixture.harness.fake", title, prompt: title },
      });
      expect(response.ok()).toBe(true);
      return {
        type: "session",
        extensionId: "pstdio",
        projectId,
        id: (await response.json()).id as string,
        label: title,
      };
    };
    const source = await sessionRef("Link source session");
    const target = await sessionRef("Release investigation");
    const other = await sessionRef("Build investigation");
    const anchors = `${uiOrigin}/v1/projects/${projectId}/resource-anchors`;
    expect((await request.post(`${anchors}/add`, { data: { resource: source, anchors: [target, other] } })).ok()).toBe(
      true,
    );
    await page.route(`**/v1/projects/${projectId}/resource-anchors/remove`, async (route) => {
      intercepted.resolve(route.request().postDataJSON().refs[0].id as string);
      await release.promise;
      await route.fulfill({ status: 403, json: { error: "Relationship removal was rejected" } });
    });

    await page.addInitScript(() => localStorage.setItem("onboarding-complete", "true"));
    const ref = encodeURIComponent(`pstdio://extension-resource/session/${source.id}`);
    await page.goto(`/projects/${projectId}/session?resource=${ref}`);
    await expect(page.getByRole("option", { name: "Search", exact: true })).toBeVisible();
    await page.keyboard.press("ControlOrMeta+KeyP");
    const palette = page.getByRole("dialog", { name: "Command palette" });
    await palette.getByRole("textbox").fill("> Related resources");
    await expect(palette.getByText("Related resources", { exact: true })).toBeVisible({ timeout: 8000 });
    await palette.getByText("Related resources", { exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Related resources", exact: true });
    await expect(dialog.getByText(target.label, { exact: true })).toBeVisible();
    await expect(dialog.getByText(other.label, { exact: true })).toBeVisible();
    await dialog.getByRole("button", { name: "Link actions" }).first().click();
    await page.getByRole("menuitem", { name: "Remove link", exact: true }).click();
    const id = await intercepted.promise;
    const removed = id === target.id ? target : other;
    const unrelated = id === target.id ? other : target;
    await expect(dialog.getByRole("status")).toBeVisible();
    await expect(dialog.getByText(removed.label, { exact: true })).toHaveCount(0);
    await expect(dialog.getByText(unrelated.label, { exact: true })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Link actions" })).toBeEnabled();

    release.resolve();
    await expect(dialog.getByRole("alert")).toBeVisible();
    await expect(dialog.getByText(removed.label, { exact: true })).toBeVisible();
    await expect(dialog.getByText(unrelated.label, { exact: true })).toBeVisible();
  } finally {
    release.resolve();
    if (projectId) await request.delete(`${uiOrigin}/v1/projects/${projectId}`);
    rmSync(repo, { recursive: true, force: true });
  }
});
