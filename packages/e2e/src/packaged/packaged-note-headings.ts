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
  const row = page.locator('[data-workbench-region="sidenav"]').getByRole("option", {
    name: "Heading formatting",
    exact: true,
  });
  await editor.evaluate((node) => node.setAttribute("data-editor-reuse-proof", "retained"));
  for (const region of ["side", "secondary"] as const) {
    const tab = page.getByRole("tab", { name: "Heading formatting", exact: true });
    await tab.focus();
    await page.keyboard.press("Shift+F10");
    const destination = region === "side" ? "Move to Side" : "Move to Secondary";
    await page.getByRole("menuitem", { name: destination, exact: true }).click();
    const listing = `${origin}/projects/${projectId}/extensions/pstdio.pstdio-notes/notes`;
    await page.evaluate((url) => {
      history.pushState(null, "", url);
      dispatchEvent(new PopStateEvent("popstate"));
    }, listing);
    await expect(row).toBeVisible();
    await row.click();
    await expect(page).toHaveURL(listing);
    await expect(
      page.locator(`[data-workbench-panel-header="${region}"]`).getByRole("tab", {
        name: "Heading formatting",
        exact: true,
      }),
    ).toBeVisible();
    await expect(tab).toHaveCount(1);
    await expect(editor).toHaveAttribute("data-editor-reuse-proof", "retained");
    await expect(editor).toContainText("Third paragraph.");
  }
  await row.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Delete", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete", exact: true }).click();
  await expect(row).toHaveCount(0);
  await expect(page.getByRole("tab", { name: "Heading formatting", exact: true })).toHaveCount(0);
  await expect.poll(() => execute("pstdio.pstdio-notes.command.notes.resolve", { noteId: note.id })).toBeNull();
};
