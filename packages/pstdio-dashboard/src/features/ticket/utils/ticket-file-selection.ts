import type { ApiTicketFilesResponse } from "@/features/ticket-list/data/api";

export const TICKET_CONTENT_ITEM_ID = "ticket";
export const TICKET_CONTENT_FILE_NAME = "ticket.md";

export type SelectableTicketFile = {
  id: string;
  fileName: string;
  label: string;
};

export const stripFileExtension = (fileName: string) => {
  const lastDot = fileName.lastIndexOf(".");
  return lastDot > 0 ? fileName.slice(0, lastDot) : fileName;
};

const IMAGE_FILE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "svg", "webp", "avif", "bmp", "ico"]);

export const isImageFileName = (fileName: string) => {
  const extension = fileName.split(".").pop()?.toLowerCase() ?? "";
  return IMAGE_FILE_EXTENSIONS.has(extension);
};

export const buildSelectableTicketFiles = (data: ApiTicketFilesResponse | undefined) => {
  const fileEntries: SelectableTicketFile[] = [];
  const seenFileIds = new Set<string>();

  for (const file of data?.files ?? []) {
    if (file.file_name === TICKET_CONTENT_FILE_NAME) continue;
    if (file.file_kind === "artifact") continue;
    if (seenFileIds.has(file.id)) continue;

    seenFileIds.add(file.id);
    fileEntries.push({
      id: file.id,
      fileName: file.file_name,
      label: stripFileExtension(file.file_name),
    });
  }

  return fileEntries;
};

export const resolveSelectedTicketFile = (files: SelectableTicketFile[], selectedFileId: string | undefined) => {
  if (!selectedFileId) {
    return {
      id: TICKET_CONTENT_ITEM_ID,
      fileName: TICKET_CONTENT_FILE_NAME,
      label: "Ticket",
    } satisfies SelectableTicketFile;
  }

  const selectedFile = files.find((file) => file.id === selectedFileId);

  if (!selectedFile) {
    return {
      id: TICKET_CONTENT_ITEM_ID,
      fileName: TICKET_CONTENT_FILE_NAME,
      label: "Ticket",
    } satisfies SelectableTicketFile;
  }

  return selectedFile;
};
