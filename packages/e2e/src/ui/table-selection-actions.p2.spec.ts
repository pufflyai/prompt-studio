import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { expect, test } from "@playwright/test";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { folderProjectInput } from "../helpers/folder-project";
import { uiOrigin } from "../ui-server";

const repoRoot = resolve(import.meta.dirname, "../../../..");
let cleanup: { sourcePath: string; projectId?: string } | undefined;

test.afterEach(async ({ request }) => {
  const owned = cleanup;
  cleanup = undefined;
  if (!owned) return;
  try {
    if (owned.projectId) expect((await request.delete(`${uiOrigin}/v1/projects/${owned.projectId}`)).ok()).toBe(true);
  } finally {
    rmSync(owned.sourcePath, { force: true, recursive: true });
  }
});

// Risk: users can tick rows in a table that is not paged, but its selection actions never appear.
test("ticking rows in a table that is not paged offers and runs its selection actions", async ({ page, request }) => {
  const parent = join(repoRoot, "__test-tmp__");
  mkdirSync(parent, { recursive: true });
  const sourcePath = mkdtempSync(join(parent, "table-selection-"));
  cleanup = { sourcePath };
  execFileSync("bun", [
    "build",
    join(import.meta.dirname, "../fixtures/table-selection/extension.ts"),
    "--target=bun",
    "--outfile",
    join(sourcePath, "extension.ts"),
  ]);
  writeFileSync(
    join(sourcePath, "package.json"),
    JSON.stringify({
      name: "table-selection",
      publisher: "e2e",
      version: "0.1.0",
      main: "extension.ts",
      type: "module",
      engines: { pstdio: `^${EXTENSION_API_VERSION}` },
    }),
  );
  const projectPath = join(sourcePath, "project");
  mkdirSync(projectPath);
  const project = await request.post(`${uiOrigin}/v1/projects`, {
    data: folderProjectInput({ name: "Table selection" }, projectPath),
  });
  expect(project.ok(), await project.text()).toBe(true);
  const projectId = (await project.json()).id as string;
  cleanup.projectId = projectId;
  const enabled = await request.post(
    `${uiOrigin}/v1/projects/${projectId}/extensions/installed/table-selection/enable`,
    {
      data: {
        displayName: "Table selection",
        extensionId: "e2e.table-selection",
        manifest: { id: "e2e.table-selection", name: "table-selection" },
        name: "table-selection",
        sourceHash: "table-selection",
        sourceKind: "local_path",
        sourcePath,
        sourceRef: null,
        version: "0.1.0",
      },
    },
  );
  expect(enabled.ok(), await enabled.text()).toBe(true);
  await page.addInitScript((id) => {
    localStorage.setItem("onboarding-complete", "true");
    localStorage.setItem("dashboard-wb2:selected-project:global", id);
  }, projectId);

  await page.goto(`/projects/${projectId}/extensions/e2e.table-selection/tasks`);
  await page.getByRole("row", { name: /Beta/ }).getByRole("checkbox").check({ force: true });
  const toolbar = page.getByRole("toolbar", { name: "Selection actions" });
  await expect(toolbar).toContainText("1 rows selected");
  await toolbar.getByRole("button", { name: "Archive", exact: true }).click();
  await expect(page.getByText("Archived beta")).toBeVisible();
});
