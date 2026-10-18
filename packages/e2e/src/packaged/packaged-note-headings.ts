import { expect, type Page } from "@playwright/test";
import type { WorkbenchExtensionMetadata } from "pstdio-api-contracts";
import { showSidenavEntry } from "../ui/helpers/sidenav-navigation";

export const verifyPackagedNoteHeadings = async (
  page: Page,
  origin: string,
  projectId: string,
  headers: Record<string, string>,
) => {
  const endpoint = `${origin}/v1/projects/${projectId}/extensions`;
  const execute = async (id: string, params: object) => {
    const response = await fetch(`${endpoint}/commands/${id}/execute`, {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({ params, source: "api" }),
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.outcome.status).toBe("success");
    return body.outcome.value;
  };
  const metadataResponse = await fetch(`${endpoint}/ui`, { headers });
  expect(metadataResponse.status).toBe(200);
  const metadata = (await metadataResponse.json()) as WorkbenchExtensionMetadata;
  const view = metadata.views.find((entry) => entry.id === "pstdio.pstdio-notes.view.note-editor");
  if (view?.body.kind !== "file") throw new Error("Missing Notes file editor");
  const note = (await execute("pstdio.pstdio-notes.command.notes.create", { title: "Heading formatting" })) as {
    id: string;
  };
  const renderer = { rendererId: view.id, projectId, resource: { type: "note", id: note.id } };
  const paragraphs = ["First paragraph.", "Second paragraph.", "Third paragraph."];
  await execute(view.body.saveHandlerId!, { renderer, content: paragraphs.join("\n\n\n\n") });
  await page.goto(`${origin}/projects/${projectId}/extensions/pstdio.pstdio-notes/notes`);
  await (await showSidenavEntry(page, "Notes")).click();
  await page.locator('[data-workbench-region="sidenav"]').getByText("Heading formatting", { exact: true }).click();
  const editor = page.locator('[contenteditable="true"]:visible');
  await expect(editor).toContainText("Third paragraph.");
  await editor.click();
  await editor.press("ControlOrMeta+a");
  await page
    .locator(".floating-text-format-toolbar.active")
    .getByRole("button", { name: "Heading 2", exact: true })
    .click();
  const expected = paragraphs.map((paragraph) => `## ${paragraph}`).join("\n\n\n\n");
  const loadHandlerId = view.body.loadHandlerId;
  await expect.poll(async () => (await execute(loadHandlerId, { renderer })).content).toBe(expected);
  // Reopening verifies the saved Markdown, rather than the unsaved Lexical view.
  await page.reload();
  for (const paragraph of paragraphs) {
    await expect(editor.getByRole("heading", { level: 2, name: paragraph, exact: true })).toBeVisible();
  }
};
