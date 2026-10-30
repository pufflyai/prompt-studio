import { afterEach, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { DEFAULT_OUT } from "./manifest";
import { createTestProject, sampleProject, writeProjectFiles } from "./test-project";

const CLI = resolve(import.meta.dir, "../../bin/pstdio-canvas.ts");
const projects: { dispose: () => void }[] = [];
afterEach(() => {
  for (const project of projects.splice(0)) project.dispose();
});
const run = (cwd: string, args: string[]) => {
  const result = Bun.spawnSync([process.execPath, CLI, ...args], { cwd, stdout: "pipe", stderr: "pipe" });
  return { exitCode: result.exitCode, stdout: result.stdout.toString(), stderr: result.stderr.toString() };
};

test("build writes the folder UI Canvas reads and still succeeds when a canvas fails", () => {
  const project = createTestProject({
    ...sampleProject,
    "src/broken.canvas.tsx": `import { Chart } from "missing-chart-package";\nexport const Default = () => <Chart />;\n`,
  });
  projects.push(project);

  const build = run(project.root, ["build"]);
  expect(build.exitCode).toBe(0);
  expect(build.stdout).toContain("Built 3 canvases, 1 failed");
  expect(build.stderr).toContain("src/broken.canvas.tsx");
  expect(existsSync(join(project.root, DEFAULT_OUT, "manifest.json"))).toBe(true);
  expect(run(project.root, ["build"]).stdout).toContain("Canvases are current");

  writeProjectFiles(project.root, { "src/broken.canvas.tsx": "export const Default = () => <p />;\n" });
  expect(run(project.root, ["build", "--out", "previews"]).stdout).toContain(
    "Built 3 canvases, 0 failed into previews",
  );
});

test("list prints the project's canvases", () => {
  const project = createTestProject(sampleProject);
  projects.push(project);
  const list = run(project.root, ["list"]);
  expect(list.exitCode).toBe(0);
  expect(JSON.parse(list.stdout).map((canvas: { id: string }) => canvas.id)).toEqual([
    "src/button.canvas.tsx",
    "src/card.canvas.tsx",
  ]);
  expect(run(project.root, ["unknown"]).exitCode).toBe(1);
});
