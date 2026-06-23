import type { ClipboardEvent, DragEvent } from "react";

export const DEFAULT_TEXT_ATTACHMENT_PASTE_LINE_THRESHOLD = 200;

export const shouldAttachPastedText = (text: string, lineThreshold = DEFAULT_TEXT_ATTACHMENT_PASTE_LINE_THRESHOLD) =>
  text.length > 0 && text.split(/\r\n|\r|\n/).length > lineThreshold;

export const createAttachmentEventHandlers = (input: {
  onAttachFiles?: (files: File[]) => void;
  onAttachText?: (text: string) => void;
  textAttachmentPasteLineThreshold: number;
}) => {
  const { onAttachFiles, onAttachText, textAttachmentPasteLineThreshold } = input;

  const onPasteCapture = (event: ClipboardEvent<HTMLDivElement>) => {
    const files = Array.from(event.clipboardData.files ?? []);
    if (files.length > 0 && onAttachFiles) {
      event.preventDefault();
      onAttachFiles(files);
      return;
    }

    const pastedText = event.clipboardData.getData("text/plain");
    if (onAttachText && shouldAttachPastedText(pastedText, textAttachmentPasteLineThreshold)) {
      event.preventDefault();
      onAttachText(pastedText);
    }
  };

  const onDropCapture = (event: DragEvent<HTMLDivElement>) => {
    const files = Array.from(event.dataTransfer.files ?? []);
    if (files.length === 0 || !onAttachFiles) return;

    event.preventDefault();
    onAttachFiles(files);
  };

  const onDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (!onAttachFiles || !Array.from(event.dataTransfer.types).includes("Files")) return;
    event.preventDefault();
  };

  return { onDragOver, onDropCapture, onPasteCapture };
};
