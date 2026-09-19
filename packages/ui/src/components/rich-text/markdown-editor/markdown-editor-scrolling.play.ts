import { expect, waitFor } from "storybook/test";

export const scrollingMarkdown = Array.from(
  { length: 30 },
  (_, index) => `Paragraph ${index + 1}: select this text and scroll to check the formatting menu.`,
).join("\n\n");

export const checkSelectionToolbarScrolling = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
  const ownerDocument = canvasElement.ownerDocument;
  const editor = canvasElement.querySelector<HTMLElement>('[contenteditable="true"]');
  const text = editor?.querySelectorAll("p")[5]?.firstChild?.firstChild;
  const selection = ownerDocument.getSelection();
  if (!editor || !text || !selection) throw new Error("The Markdown editor was not rendered.");

  let scroller = editor.parentElement;
  while (
    scroller &&
    (scroller.scrollHeight <= scroller.clientHeight || !/auto|scroll/.test(getComputedStyle(scroller).overflowY))
  ) {
    scroller = scroller.parentElement;
  }
  if (!scroller) throw new Error("The story needs a scrolling editor or ancestor.");

  scroller.scrollTop = 0;
  editor.focus();
  const range = ownerDocument.createRange();
  range.setStart(text, 0);
  range.setEnd(text, 11);
  selection.removeAllRanges();
  selection.addRange(range);

  const toolbar = ownerDocument.querySelector<HTMLElement>(".floating-text-format-toolbar");
  if (!toolbar) throw new Error("The selection toolbar was not rendered.");
  await waitFor(() => expect(toolbar).toHaveClass("active"));

  const initialSelectionTop = range.getBoundingClientRect().top;
  const initialToolbarTop = toolbar.getBoundingClientRect().top;
  scroller.scrollTop = 64;

  await waitFor(() => {
    const selectionDelta = range.getBoundingClientRect().top - initialSelectionTop;
    const toolbarDelta = toolbar.getBoundingClientRect().top - initialToolbarTop;
    expect(selectionDelta).toBe(-64);
    expect(Math.abs(toolbarDelta - selectionDelta)).toBeLessThan(1);
    expect(toolbar).toHaveClass("active");
  });

  scroller.scrollTop = 0;
  await waitFor(() => expect(toolbar.getBoundingClientRect().top).toBe(initialToolbarTop));
};
