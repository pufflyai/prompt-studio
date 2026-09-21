import { expect, userEvent, waitFor, within } from "storybook/test";
import type { WorkbenchCore } from "../../core";

export const checkFileRendererLifecycle = async (canvasElement: HTMLElement, workbench: WorkbenchCore) => {
  const canvas = within(canvasElement);
  const viewId = "file-renderer.story.markdown.widget";
  const body = workbench.views.getView(viewId)?.body;
  if (body?.kind !== "file" || !body.save) throw new Error("The markdown example must be editable.");
  const document = canvasElement.ownerDocument;
  const editor = () => canvas.getByRole("textbox");

  await userEvent.click(await canvas.findByRole("tab", { name: "notes.md" }));
  await canvas.findByRole("textbox");
  await userEvent.click(canvas.getByRole("button", { name: "Close notes.md" }));
  await waitFor(() => expect(canvas.queryByRole("tab", { name: "notes.md" })).toBeNull());

  await body.save(undefined, "# External write\n\nChanged while the document was closed.");
  workbench.views.refreshView(viewId);
  await userEvent.click(canvas.getByRole("button", { name: "Add panel" }));
  await waitFor(() => expect(editor()).toHaveTextContent("Changed while the document was closed."));

  await body.save(undefined, "# External write\n\nChanged while the document was open.");
  workbench.views.refreshView(viewId);
  await waitFor(() => expect(editor()).toHaveTextContent("Changed while the document was open."));

  const activeEditor = editor();
  await userEvent.click(activeEditor);
  const selection = document.getSelection();
  const range = document.createRange();
  range.selectNodeContents(activeEditor);
  range.collapse(false);
  selection?.removeAllRanges();
  selection?.addRange(range);
  await userEvent.paste(" Saved marker.");
  range.selectNodeContents(activeEditor);
  selection?.removeAllRanges();
  selection?.addRange(range);
  const selectedText = selection?.toString();
  await expect(selectedText).toContain("Changed while the document was open.");
  await waitFor(async () => expect((await body.load(undefined)).content).toContain("Saved marker."));

  workbench.views.refreshView(viewId);
  await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  await expect(editor()).toBe(activeEditor);
  await expect(activeEditor).toHaveFocus();
  await expect(document.getSelection()?.toString()).toBe(selectedText);
};
