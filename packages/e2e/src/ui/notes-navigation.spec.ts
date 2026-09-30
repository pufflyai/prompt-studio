import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type APIRequestContext, expect, test } from "@playwright/test";
import { folderProjectInput } from "../helpers/folder-project";
import { uiOrigin } from "../ui-server";

const executeNoteCommand = async (
  request: APIRequestContext,
  projectId: string,
  command: string,
  params: Record<string, string>,
) => {
  const response = await request.post(
    `${uiOrigin}/v1/projects/${projectId}/extensions/commands/pstdio.pstdio-notes.command.notes.${command}/execute`,
    { data: { params, source: "api" } },
  );
  expect(response.ok()).toBe(true);
  const body = await response.json();
  expect(body.outcome.status).toBe("success");
  return body.outcome.value as { id: string; title: string };
};

test("opens notes in their Sidenav level and follows the active note through navigation and deletion", async ({
  page,
  request,
}) => {
  const repoRoot = mkdtempSync(join(tmpdir(), "pstdio-notes-navigation-"));
  const response = await request.post(`${uiOrigin}/v1/projects`, {
    data: folderProjectInput({ name: "Notes navigation" }, repoRoot),
  });
  expect(response.ok()).toBe(true);
  const project = (await response.json()) as { id: string };
  try {
    await expect
      .poll(async () => {
        const response = await request.get(`${uiOrigin}/v1/projects/${project.id}/extensions/ui`);
        const metadata = await response.json();
        return metadata.views?.some((view: { id: string }) => view.id === "pstdio.pstdio-notes.view.note-editor");
      })
      .toBe(true);
    const first = await executeNoteCommand(request, project.id, "create", { title: "First note" });
    const second = await executeNoteCommand(request, project.id, "create", { title: "Second note" });
    await page.addInitScript((projectId: string) => {
      localStorage.setItem("onboarding-complete", "true");
      localStorage.setItem("dashboard-wb2:selected-project:global", projectId);
      localStorage.setItem("selected-agent", "pstdio.workbench-fixture.harness.fake");
    }, project.id);
    await page.goto(`/projects/${project.id}/extensions/pstdio.pstdio-planner/tickets`);
    const sidebar = page.locator('[data-workbench-region="sidenav"]');
    const firstRow = sidebar.getByRole("option", { name: first.title, exact: true });
    const secondRow = sidebar.getByRole("option", { name: second.title, exact: true });
    await expect(firstRow).toHaveCount(0);
    await sidebar.getByRole("option", { name: "Notes", exact: true }).click();
    // The Notes level replaces the project rows with the notes themselves.
    await expect(firstRow).toHaveAttribute("aria-level", "1");
    await expect(sidebar.getByRole("option", { name: "Tickets", exact: true })).toHaveCount(0);
    await firstRow.click();
    await expect(firstRow).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("tab", { name: first.title, exact: true })).toHaveAttribute("aria-selected", "true");
    await secondRow.click();
    await expect(secondRow).toHaveAttribute("aria-selected", "true");
    await page.getByRole("tab", { name: first.title, exact: true }).click();
    await expect(firstRow).toHaveAttribute("aria-selected", "true");
    await expect(secondRow).toHaveAttribute("aria-selected", "false");

    await secondRow.click();
    await expect(secondRow).toHaveAttribute("aria-selected", "true");
    await executeNoteCommand(request, project.id, "delete", { noteId: second.id });
    await expect(secondRow).toHaveCount(0);
    await expect(firstRow).toHaveAttribute("aria-selected", "true");
    await page.getByRole("button", { name: `Close ${first.title}`, exact: true }).click();
    await expect(firstRow).toHaveAttribute("aria-selected", "false");
    await expect(page.getByText("No note open", { exact: true })).toBeVisible();
  } finally {
    rmSync(repoRoot, { recursive: true, force: true });
  }
});

test("keeps note titles independent of the body and renames them through the context menu", async ({
  page,
  request,
}) => {
  const repoRoot = mkdtempSync(join(tmpdir(), "pstdio-note-titles-"));
  const response = await request.post(`${uiOrigin}/v1/projects`, {
    data: folderProjectInput({ name: "Note titles" }, repoRoot),
  });
  expect(response.ok()).toBe(true);
  const project = (await response.json()) as { id: string };
  try {
    const note = await executeNoteCommand(request, project.id, "create", { title: "Original title" });
    await page.addInitScript((projectId: string) => {
      localStorage.setItem("onboarding-complete", "true");
      localStorage.setItem("dashboard-wb2:selected-project:global", projectId);
      localStorage.setItem("selected-agent", "pstdio.workbench-fixture.harness.fake");
    }, project.id);
    await page.goto(`/projects/${project.id}/extensions/pstdio.pstdio-notes/notes`);
    const sidebar = page.locator('[data-workbench-region="sidenav"]');
    const row = sidebar.getByRole("option", { name: note.title, exact: true });
    await row.click();
    const editor = page.getByTestId("content-editable").filter({ visible: true }).first();
    await expect(editor).toBeEmpty();
    const body = "Body text with a different name";
    await editor.fill(body);
    await expect
      .poll(() =>
        readFileSync(`${repoRoot}/.pstdio/extension-storage/pstdio-notes/documents/${note.id}/content.md`, "utf8"),
      )
      .toContain(body);
    await expect(row).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("tab", { name: note.title, exact: true })).toHaveAttribute("aria-selected", "true");

    await row.click({ button: "right" });
    await page.getByRole("menuitem", { name: "Rename note", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("textbox")).toHaveValue(note.title);
    await dialog.getByRole("textbox").fill("Renamed title");
    await dialog.getByRole("button", { name: "Rename", exact: true }).click();
    const renamed = sidebar.getByRole("option", { name: "Renamed title", exact: true });
    await expect(renamed).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("tab", { name: "Renamed title", exact: true })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(editor).toHaveText(body);

    await page.reload();
    await expect(renamed).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("tab", { name: "Renamed title", exact: true })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(editor).toHaveText(body);
    await executeNoteCommand(request, project.id, "rename", { noteId: note.id, title: "Renamed remotely" });
    await expect(sidebar.getByRole("option", { name: "Renamed remotely", exact: true })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(page.getByRole("tab", { name: "Renamed remotely", exact: true })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  } finally {
    rmSync(repoRoot, { recursive: true, force: true });
  }
});
