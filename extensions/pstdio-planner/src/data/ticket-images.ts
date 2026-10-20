import type { ArtifactMount, ExtensionStorageApi } from "@pstdio/sdk/extensions";
import { imageMimeType } from "../utils/is-image-attachment";
import { fileNameFromPath, ticketFilesDir } from "./draft-storage";
import { validateTicketFileName } from "./ticket-file-name";
import { readTicketImageCheckout, writeTicketImageCheckout } from "./ticket-image-checkout";
import { ticketImagePaths } from "./ticket-image-paths";
import type { Ticket } from "./types";

export const isImagePath = (path: string) => imageMimeType(path) !== null;

const sha256 = async (data: Uint8Array) => {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new Uint8Array(data)));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
};

// Images in the local files folder become ticket attachments, stored in the same
// ticket scope as dashboard uploads. Save never removes an attachment: a dashboard
// upload is not in the local folder until the next pull.
export const saveTicketImages = async (
  storage: ExtensionStorageApi,
  projectFiles: ArtifactMount,
  ticket: Ticket,
  paths: string[],
) => {
  const files = storage.scope({ type: "resource", resource: { type: "ticket", id: ticket.id } }).files;
  const attachments = [...(ticket.attachments ?? [])];
  const checkout = await readTicketImageCheckout(projectFiles, ticket.shorthand);
  const replacedIds: string[] = [];

  for (const path of paths) {
    const name = validateTicketFileName(fileNameFromPath(ticket.shorthand, path));
    const data = await projectFiles.readBytes(path);
    const hash = await sha256(data);
    const previous =
      attachments.find((attachment) => attachment.id === checkout[name]) ??
      attachments.find((attachment) => attachment.name === name && attachment.hash === hash);
    const index = attachments.findIndex((attachment) => attachment.id === previous?.id);
    if (previous?.hash === hash) {
      checkout[name] = previous.id;
      continue;
    }

    const attachment = {
      ...(await files.put({ name: previous?.name ?? name, data, mimeType: imageMimeType(name) })),
      hash,
    };
    if (index === -1) {
      attachments.push(attachment);
    } else {
      replacedIds.push(attachments[index].id);
      attachments[index] = attachment;
    }
    checkout[name] = attachment.id;
  }

  const ids = new Set(attachments.map(({ id }) => id));
  return {
    attachments,
    replacedIds,
    checkout: Object.fromEntries(Object.entries(checkout).filter(([, id]) => ids.has(id))),
  };
};

export const pullTicketImages = async (storage: ExtensionStorageApi, projectFiles: ArtifactMount, ticket: Ticket) => {
  const files = storage.scope({ type: "resource", resource: { type: "ticket", id: ticket.id } }).files;
  const checkout = await readTicketImageCheckout(projectFiles, ticket.shorthand);
  const images = ticketImagePaths(ticket, checkout);
  for (const { name, attachment } of images) {
    const path = `${ticketFilesDir(ticket.shorthand)}/${name}`;
    await projectFiles.writeBytes(path, await files.getBytes(attachment.id));
  }
  await writeTicketImageCheckout(
    projectFiles,
    ticket.shorthand,
    Object.fromEntries(images.map(({ name, attachment }) => [name, attachment.id])),
  );
};
