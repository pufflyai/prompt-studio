import { type ChildProcess, spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { expect, test } from "@playwright/test";
import { folderProjectInput } from "../helpers/folder-project";

const repoRoot = resolve(import.meta.dirname, "../../../..");

const writeProject = (root: string, label: string) => {
  const files: Record<string, string> = {
    "package.json": `{ "name": "canvas-project", "private": true }\n`,
    "src/button.tsx": `export const Button = (props: { label: string }) => <button>${label}: {props.label}</button>;\n`,
    "src/button.canvas.tsx": `import { Button } from "./button";
export default { title: "Components/Button", component: Button };
export const Primary = { args: { label: "Save" } };
`,
  };
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
  }
};

// Critical: seeing a project's own components is UI Canvas's primary task. A project that runs
// `pstdio-canvas watch` must see its canvas, and an edit must reach the open frame.
test("UI Canvas shows a project's own canvas and follows edits to its component", async ({
  page,
  request,
  baseURL,
}) => {
  const parent = process.env.E2E_FIXTURE_ROOT ?? tmpdir();
  mkdirSync(parent, { recursive: true });
  const root = mkdtempSync(join(parent, "canvas-project-"));
  let watcher: ChildProcess | undefined;
  try {
    writeProject(root, "Version 1");
    mkdirSync(join(root, "node_modules"));
    for (const name of ["react", "react-dom"])
      symlinkSync(join(import.meta.dirname, "../../node_modules", name), join(root, "node_modules", name), "dir");

    const created = await request.post(`${baseURL}/v1/projects`, {
      data: folderProjectInput({ name: "Canvas project" }, root),
    });
    expect(created.ok(), await created.text()).toBe(true);
    const project = (await created.json()) as { id: string };
    watcher = spawn("bun", [join(repoRoot, "packages/canvas/bin/pstdio-canvas.ts"), "watch", "--root", root], {
      stdio: "inherit",
    });
    const list = async () => {
      const response = await request.post(
        `${baseURL}/v1/projects/${project.id}/extensions/commands/pstdio.canvas.command.list/execute`,
        { data: { source: "api", params: {} } },
      );
      const result = (await response.json()) as {
        outcome?: { value?: { canvases: { id: string; href: string }[] } };
      };
      return result.outcome?.value?.canvases ?? [];
    };
    await expect
      .poll(async () => (await list()).map((canvas) => canvas.id), { timeout: 30_000 })
      .toEqual(["src/button.canvas.tsx"]);

    await page.addInitScript(() => localStorage.setItem("onboarding-complete", "true"));
    await page.goto((await list())[0]!.href);
    const viewer = page.frameLocator('iframe[title="UI Canvas"]');
    const frame = viewer.frameLocator('iframe[data-frame-ready="true"]');
    await expect(frame.getByRole("button", { name: "Version 1: Save" })).toBeVisible({ timeout: 30_000 });

    writeProject(root, "Version 2");
    await expect(frame.getByRole("button", { name: "Version 2: Save" })).toBeVisible({ timeout: 30_000 });
    await expect(viewer.locator("[data-ui-canvas-error]")).toHaveCount(0);
  } finally {
    watcher?.kill();
    rmSync(root, { recursive: true, force: true });
  }
});
