import { extname } from "node:path";
import { imageExtensionForMimeType, imageMimeType } from "../utils/is-image-attachment";
import { validateTicketFileName } from "./ticket-file-name";
import type { TicketImageCheckout } from "./ticket-image-checkout";
import type { Ticket } from "./types";

// Preserve known checkout paths and allocate distinct names for new attachments.
export const ticketImagePaths = (ticket: Ticket, checkout: TicketImageCheckout) => {
  const images = (ticket.attachments ?? []).flatMap((attachment) => {
    const name = validateTicketFileName(attachment.name);
    if (imageMimeType(name)) return [{ attachment, name }];
    const extension = imageExtensionForMimeType(attachment.mimeType);
    return extension ? [{ attachment, name: `${name}.${extension}` }] : [];
  });
  const namesById = new Map(Object.entries(checkout).map(([name, id]) => [id, name]));
  const reserved = new Set([...Object.keys(checkout), ...images.map(({ name }) => name)]);
  const assigned = new Set(Object.keys(checkout));
  return images.map(({ attachment, name: originalName }) => {
    const existing = namesById.get(attachment.id);
    if (existing) return { name: existing, attachment };
    let name = originalName;
    if (assigned.has(name)) {
      const extension = extname(name);
      const stem = name.slice(0, name.length - extension.length);
      let suffix = 2;
      do {
        name = `${stem} (${suffix})${extension}`;
        suffix += 1;
      } while (reserved.has(name));
      reserved.add(name);
    }
    assigned.add(name);
    return { name, attachment };
  });
};
