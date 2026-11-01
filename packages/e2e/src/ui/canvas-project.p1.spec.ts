import { type ChildProcess, spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { expect, test } from "@playwright/test";
import { folderProjectInput } from "../helpers/folder-project";
import { stopChildProcess } from "../scripts/child-process";

const repoRoot = resolve(import.meta.dirname, "../../../..");

const writeProject = (root: string, label: string, color = "rgb(0, 128, 0)") => {
  const files: Record<string, string> = {
    "package.json": `{ "name": "canvas-project", "private": true }\n`,
    "src/button.css": `.button { color: ${color}; }\n`,
    "src/button.tsx": `import "./button.css";\nexport const Button = (props: { label: string }) => <button className="button">${label}: {props.label}</button>;\n`,
    "src/default.json": '{"name":"Default","values":{"label":"Save"}}',
    "src/button.canvas.tsx": `import { Button } from "./button";
import config from "./default.json";
export default { title: "Components/Button", component: Button, args: config.values,
 controls: { label: { type: "select", label: "Label", options: [{ value: "Save", label: "Save" }, { value: "Archive", label: "Archive" }] } },
 save: { file: "default.json", key: "values" } };
export const Primary = {};
`,
  };
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
  }
};

// Critical: seeing a project's own components is UI Canvas's primary task. A project that runs
// `pstdio-canvas watch` must see its canvas, and edits, including style-only ones, must reach the
// open frame.
test("UI Canvas shows a project's own canvas and follows edits to its component and styles", async ({
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
    // Opened before any build exists, the navigation tree must fill in once the watcher writes one.
    await page.addInitScript(() => localStorage.setItem("onboarding-complete", "true"));
    await page.goto(`/projects/${project.id}/extensions/pstdio.canvas/canvases`);
    await expect(page.getByText("UI Canvas", { exact: true }).first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("Components", { exact: true })).toHaveCount(0);
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

    await expect(page.getByText("Components", { exact: true }).first()).toBeVisible({ timeout: 30_000 });
    await page.goto((await list())[0]!.href);
    const viewer = page.frameLocator('iframe[title="UI Canvas"]');
    const frame = viewer.frameLocator('iframe[data-frame-ready="true"]');
    await expect(frame.getByRole("button", { name: "Version 1: Save" })).toBeVisible({ timeout: 30_000 });

    writeProject(root, "Version 2");
    const button = frame.getByRole("button", { name: "Version 2: Save" });
    await expect(button).toBeVisible({ timeout: 30_000 });
    await expect(button).toHaveCSS("color", "rgb(0, 128, 0)");

    // Bun keeps a chunk's name when only its stylesheet changes; the frame must still reload.
    writeFileSync(join(root, "src/button.css"), ".button { color: rgb(255, 0, 0); }\n");
    await expect(frame.getByRole("button", { name: "Version 2: Save" })).toHaveCSS("color", "rgb(255, 0, 0)", {
      timeout: 30_000,
    });
    await expect(viewer.locator("[data-ui-canvas-error]")).toHaveCount(0);

    // Critical: saving is explicit, durable, and failures retain the frame's edits for retry.
    await viewer.locator("[data-canvas-select]").click();
    await viewer.getByRole("button", { name: "Parameters", exact: true }).click();
    const parameters = viewer.getByRole("dialog", { name: "Parameters" });
    await parameters.getByRole("button", { name: "Save", exact: true }).first().click();
    await viewer.getByRole("menuitemradio", { name: "Archive", exact: true }).click();
    await expect(frame.getByRole("button", { name: "Version 2: Archive" })).toBeVisible();
    const readValues = (file: string) => JSON.parse(readFileSync(join(root, "src", file), "utf8")).values;
    expect(readValues("default.json")).toEqual({ label: "Save" });
    await parameters.getByRole("textbox", { name: "Version name" }).fill("Alternate");
    await parameters.getByRole("button", { name: "Save as new version", exact: true }).click();
    await expect(parameters.getByRole("textbox", { name: "Version name" })).toHaveValue("");
    await expect(parameters.getByRole("alert")).toHaveCount(0);
    await expect.poll(() => readValues("alternate.json")).toEqual({ label: "Archive" });
    await page.reload();
    await expect(frame.getByRole("button", { name: "Version 2: Archive" })).toBeVisible();
    await viewer.locator("[data-canvas-select]").click();
    await viewer.getByRole("button", { name: "Parameters", exact: true }).click();
    await parameters.getByRole("button", { name: "Archive", exact: true }).click();
    await viewer.getByRole("menuitemradio", { name: "Save", exact: true }).click();
    writeFileSync(join(root, "src/alternate.json"), "{}");
    await parameters.getByRole("button", { name: "Save", exact: true }).last().click();
    await expect(parameters.getByRole("alert")).toBeVisible();
    await expect(frame.getByRole("button", { name: "Version 2: Save" })).toBeVisible();
    writeFileSync(join(root, "src/alternate.json"), '{"name":"Alternate","values":{"label":"Archive"}}');
    await parameters.getByRole("button", { name: "Save", exact: true }).last().click();
    await expect.poll(() => readValues("alternate.json")).toEqual({ label: "Save" });
    expect(readValues("default.json")).toEqual({ label: "Save" });
  } finally {
    await stopChildProcess(watcher);
    rmSync(root, { recursive: true, force: true });
  }
});
