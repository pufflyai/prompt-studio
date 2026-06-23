export const createClipboardAttachmentFile = (text: string, index: number) =>
  new File([text], `clipboard-${index}.txt`, { type: "text/plain" });
