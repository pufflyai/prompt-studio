import { expect, type Page } from "@playwright/test";
import { createClient } from "@pstdio/sdk/client";
import { createTextEditingClient } from "@pstdio/sdk/extensions";
import type { WorkbenchExtensionMetadata } from "pstdio-api-contracts";
import { showSidenavEntry } from "../ui/helpers/sidenav-navigation";

export const verifyPackagedNoteHeadings = async (page: Page, origin: string, projectId: string, token: string) => {
  const headers = { authorization: `Bearer ${token}` };
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
  const view = metadata.views.find((entry) => entry.id === "pstdio.notes.view.note-editor");
  if (view?.body.kind !== "file") throw new Error("Missing Notes file editor");
  const note = (await execute("pstdio.notes.command.notes.create", { title: "Heading formatting" })) as {
    id: string;
  };
  const renderer = { rendererId: view.id, projectId, resource: { type: "note", id: note.id } };
  const paragraphs = ["First paragraph.", "Second paragraph.", "Third paragraph."];
  const client = createClient({ baseUrl: origin, token });
  const connection = await client.textEditing.connect({
    projectId,
    scope: { kind: "agent", target: { fileRendererId: view.id, resource: { type: "note", id: note.id } } },
  });
  const guest = connection.guest();
  let header = "";
  try {
    const editing = createTextEditingClient(guest.host);
    const grant = await editing.current();
    expect(grant).toBeDefined();
    const session = await editing.open({ grant: grant! });
    try {
      session.transact((text) => {
        header = `${text.toString()}\n\n`;
        text.insert(text.length, `\n\n${paragraphs.join("\n\n\n\n")}`);
      });
      await session.flush();
      await session.project();
    } finally {
      await session.close();
    }
  } finally {
    await guest.close();
  }
  await page.goto(`${origin}/projects/${projectId}/extensions/pstdio.notes/notes`);
  const notes = await showSidenavEntry(page, "Notes");
  if ((await notes.getAttribute("aria-expanded")) !== "true") await notes.click();
  await page.locator('[data-workbench-region="sidenav"]').getByText("Heading formatting", { exact: true }).click();
  const editor = page.locator('[contenteditable="true"]:visible');
  await expect(editor).toContainText("Third paragraph.");
  await editor.click();
  await editor.press("ControlOrMeta+a");
  await page
    .locator(".floating-text-format-toolbar.active")
    .getByRole("button", { name: "Heading 2", exact: true })
    .click();
  const expected = header + paragraphs.map((paragraph) => `## ${paragraph}`).join("\n\n\n\n");
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
  await row.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Delete", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Delete note", exact: true }).click();
  await expect(row).toHaveCount(0);
  await expect(page.getByRole("tab", { name: "Heading formatting", exact: true })).toHaveCount(0);
  await expect.poll(() => execute("pstdio.notes.command.notes.resolve", { noteId: note.id })).toBeNull();
};
