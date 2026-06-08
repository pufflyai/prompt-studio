import { listProjectExtensions, uploadExtensionFile } from "@/shared/extensions/api";
import {
  executePlannerCommand,
  type PlannerTicketAttachment,
  type PlannerTicketFile,
  readPlannerTicket,
} from "./planner";
import type { ApiTicketFilesResponse } from "./types";

const PLANNER_INSTALL_NAME = "pstdio-planner";
const IMAGE_FILE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "svg", "webp", "avif", "bmp", "ico"]);
const TEXT_FILE_EXTENSIONS = new Set([
  "bash",
  "css",
  "csv",
  "go",
  "html",
  "java",
  "js",
  "json",
  "jsx",
  "md",
  "py",
  "rb",
  "rs",
  "scss",
  "sh",
  "sql",
  "toml",
  "ts",
  "tsx",
  "txt",
  "xml",
  "yaml",
  "yml",
  "zsh",
]);

// `accept` hint for ticket file pickers: the only kinds uploadTicketFile keeps.
export const TICKET_UPLOAD_ACCEPT = [
  "image/*",
  "text/*",
  ...[...IMAGE_FILE_EXTENSIONS, ...TEXT_FILE_EXTENSIONS].map((extension) => `.${extension}`),
].join(",");

const extensionOf = (name: string) => name.split(".").pop()?.toLowerCase() ?? "";

const isImageAttachment = (attachment: PlannerTicketAttachment) =>
  attachment.mimeType?.startsWith("image/") || IMAGE_FILE_EXTENSIONS.has(extensionOf(attachment.name));

const isImageFile = (file: File) => file.type.startsWith("image/") || IMAGE_FILE_EXTENSIONS.has(extensionOf(file.name));

const isTextFile = (file: File) => file.type.startsWith("text/") || TEXT_FILE_EXTENSIONS.has(extensionOf(file.name));

const toFilePreview = (file: PlannerTicketFile) => ({
  id: file.id,
  file_name: file.name,
  file_kind: "ticket",
  mime_type: file.name.endsWith(".md") ? "text/markdown" : "text/plain",
  size_bytes: new TextEncoder().encode(file.content).byteLength,
  created_at: file.createdAt,
});

const toAttachmentPreview = (attachment: PlannerTicketAttachment) => ({
  id: attachment.id,
  file_name: attachment.name,
  file_kind: "ticket-attachment",
  mime_type: attachment.mimeType,
  size_bytes: attachment.size,
  created_at: attachment.createdAt,
});

const getPlannerExtensionInstanceId = async (projectId: string) => {
  const { extensions } = await listProjectExtensions(projectId);
  const planner = extensions.find((extension) => extension.installName === PLANNER_INSTALL_NAME && extension.enabled);
  if (!planner) throw new Error("Planner extension is required to upload attachments.");
  return planner.id;
};

const uploadTicketAttachment = async (projectId: string, ticketId: string, file: File) => {
  const instanceId = await getPlannerExtensionInstanceId(projectId);
  const ref = await uploadExtensionFile(projectId, instanceId, {
    name: file.name,
    data: await file.arrayBuffer(),
    mimeType: file.type || undefined,
    scope: { type: "resource", id: ticketId },
  });

  return executePlannerCommand(projectId, "attach-file", { ticketId, ref });
};

export const getTicketFiles = async (projectId: string, ticketId: string): Promise<ApiTicketFilesResponse> => {
  const ticket = await readPlannerTicket(projectId, ticketId);
  return {
    files: [
      ...(ticket?.files ?? []).map(toFilePreview),
      ...(ticket?.attachments ?? []).filter(isImageAttachment).map(toAttachmentPreview),
    ],
    artifacts: [],
  };
};

export const getTicketFileContent = async (
  projectId: string,
  ticketId: string,
  fileId: string,
  signal?: AbortSignal,
) => {
  const ticket = await readPlannerTicket(projectId, ticketId, signal);
  const ticketFile = ticket?.files?.find((file) => file.id === fileId);
  if (ticketFile) return ticketFile.content;

  const attachment = ticket?.attachments?.find((file) => file.id === fileId);
  if (!attachment) return "";

  const result = await executePlannerCommand<{ dataUrl: string } | null>(
    projectId,
    "read-ticket-attachment",
    { ticketId, attachmentId: attachment.id },
    { signal },
  );
  return result?.dataUrl ?? "";
};

export const uploadTicketFile = async (projectId: string, ticketId: string, file: File) => {
  // Images become read-only attachments; text becomes an editable ticket file. The
  // tree can only surface those two kinds, so reject anything else up front instead
  // of storing an attachment that would be invisible and unreachable.
  if (isImageFile(file)) return uploadTicketAttachment(projectId, ticketId, file);
  if (!isTextFile(file)) {
    throw new Error(`Unsupported file type for "${file.name}". Only text files and images can be attached.`);
  }

  const content = await file.text();
  const ticket = await readPlannerTicket(projectId, ticketId);
  const existing = ticket?.files?.find((candidate) => candidate.name === file.name);
  const target =
    existing ??
    (await executePlannerCommand<PlannerTicketFile>(projectId, "create-ticket-file", {
      ticketId,
      name: file.name,
    }));

  return executePlannerCommand<PlannerTicketFile>(projectId, "update-ticket-file", {
    ticketId,
    fileId: target.id,
    name: file.name,
    content,
  });
};

export const deleteTicketFile = async (projectId: string, ticketId: string, fileId: string) => {
  await executePlannerCommand(projectId, "delete-ticket-file", { ticketId, fileId });
};
