import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import type { WorkbenchCore } from "@pstdio/workbench";
import { createResourceActionsProject, prepareResourceActionsDashboard } from "./helpers/resource-actions";

test("native table dialogs keep their rows visible and reachable by pointer", async ({ page, request }) => {
  const folder = mkdtempSync(join(tmpdir(), "page-dialog-layout-"));
  let projectId: string | undefined;
  try {
    const project = await createResourceActionsProject(request, folder);
    projectId = project.id;
    await prepareResourceActionsDashboard(page, project.id);
    await page.goto(`/projects/${project.id}/sessions`);
    await page.waitForFunction(() => {
      const host = window as Window & { __pstdioDashboardWorkbench?: WorkbenchCore };
      return Boolean(host.__pstdioDashboardWorkbench?.pages.store.getState().projectId);
    });
    await page.evaluate(async () => {
      const host = window as Window & { __pstdioDashboardWorkbench?: WorkbenchCore };
      const workbench = host.__pstdioDashboardWorkbench!;
      const id = "dialog-layout-table";
      workbench.views.registerView({
        id,
        title: "Dialog table",
        body: {
          kind: "dataTable",
          columns: [{ id: "name", label: "Name", type: "string" }],
          executeQuery: () => ({ rows: [{ id: "one", values: { name: "Reachable dialog row" } }] }),
        },
      });
      const ref = { kind: "page" as const, extensionId: "example.layout", id };
      workbench.pages.registerPage({
        id,
        ref,
        title: "Dialog table",
        path: id,
        modeId: workbench.modes.getActiveModeId()!,
        main: { kind: "view", view: { kind: "view", id }, cardinality: "one", presentation: "page" },
        slots: [],
      });
      await workbench.navigation.openTarget({ kind: "dialog", page: ref });
    });
    const dialog = page.getByRole("dialog", { name: "Dialog table", exact: true });
    const row = dialog.getByText("Reachable dialog row", { exact: true });
    await expect(row).toBeVisible();
    // A row can exist outside a zero-height clipping ancestor; pointer reachability proves usable content.
    await row.click({ trial: true });
    await dialog.getByRole("button", { name: "Close Dialog table", exact: true }).click();
    await expect(dialog).not.toBeVisible();
  } finally {
    if (projectId) await request.delete(`/v1/projects/${projectId}`);
    rmSync(folder, { recursive: true, force: true });
  }
});
