import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { expect, test } from "@playwright/test";
import { folderProjectInput } from "../helpers/folder-project";
import { uiOrigin as apiBase } from "../ui-server";

test("shows relative, absolute, and reference Markdown workspace images after reload", async ({ page, request }) => {
  const repo = resolve(import.meta.dirname, "../../../..");
  mkdirSync(join(repo, "__test-tmp__"), { recursive: true });
  const root = mkdtempSync(join(repo, "__test-tmp__/chat-images-"));
  const imagePath = join(root, "long question.png");
  writeFileSync(
    imagePath,
    Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9i8AAAAASUVORK5CYII=",
      "base64",
    ),
  );
  const project = await (
    await request.post(`${apiBase}/v1/projects`, {
      data: folderProjectInput({ name: "Chat image previews" }, root),
    })
  ).json();
  try {
    const enabled = await request.post(
      `${apiBase}/v1/projects/${project.id}/extensions/installed/workbench-fixture/enable`,
      {
        data: {
          displayName: "Workbench fixture",
          extensionId: "pstdio.workbench-fixture",
          manifest: { id: "pstdio.workbench-fixture", name: "workbench-fixture" },
          name: "workbench-fixture",
          sourceHash: "chat-images",
          sourceKind: "local_path",
          sourcePath: join(repo, "packages/workbench-fixture"),
          sourceRef: null,
          version: null,
        },
      },
    );
    expect(enabled.ok()).toBe(true);
    const [workspace] = await (await request.get(`${apiBase}/v1/workspaces?project_id=${project.id}`)).json();
    const response = await request.post(`${apiBase}/v1/sessions`, {
      data: {
        project_id: project.id,
        workspace_id: workspace.id,
        agent: "pstdio.workbench-fixture.harness.fake",
        title: "Image previews",
        prompt: `![Relative](long%20question.png)\n\n![Absolute](${imagePath.replaceAll(" ", "%20")})\n\n![Reference][preview]\n\n[preview]: long%20question.png\n\n![Outside workspace](../outside.png)`,
      },
    });
    expect(response.ok()).toBe(true);
    const session = await response.json();
    await page.addInitScript((project) => {
      localStorage.setItem("onboarding-complete", "true");
      localStorage.setItem("dashboard-wb2:selected-project:global", project);
    }, project.id);
    await page.goto(
      `/projects/${project.id}/session?resource=${encodeURIComponent(`pstdio://extension-resource/session/${session.id}`)}`,
    );
    for (const reload of [false, true]) {
      if (reload) await page.reload();
      for (const alt of ["Relative", "Absolute", "Reference"]) {
        const image = page.getByRole("img", { name: alt, exact: true }).last();
        await expect(image).toBeVisible();
        await expect.poll(() => image.evaluate((node: HTMLImageElement) => node.naturalWidth)).toBe(1);
        await expect(image).toHaveAttribute("src", /^data:image\/png;base64,/);
      }
      await expect(page.getByRole("img", { name: "Outside workspace", exact: true })).toHaveCount(0);
    }
  } finally {
    await request.delete(`${apiBase}/v1/projects/${project.id}`);
    rmSync(root, { recursive: true, force: true });
  }
});
