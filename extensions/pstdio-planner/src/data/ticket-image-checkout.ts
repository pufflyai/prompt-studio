import type { ArtifactMount } from "@pstdio/sdk/extensions";
import { TICKETS_DIR } from "./draft-storage";
import { validateTicketFileName } from "./ticket-file-name";

// Local paths are checkout identity, not attachment identity: dashboard names can
// repeat or arrive after a pull. Only save and pull own this local mapping.
export type TicketImageCheckout = Record<string, string>;
const checkoutPath = (shorthand: string) => `${TICKETS_DIR}/${shorthand}/image-checkout.json`;

export const readTicketImageCheckout = async (projectFiles: ArtifactMount, shorthand: string) => {
  const path = checkoutPath(shorthand);
  if (!(await projectFiles.exists(path))) return {};
  const checkout = JSON.parse(await projectFiles.readText(path)) as TicketImageCheckout;
  return Object.fromEntries(Object.entries(checkout).map(([name, id]) => [validateTicketFileName(name), id]));
};

export const writeTicketImageCheckout = (
  projectFiles: ArtifactMount,
  shorthand: string,
  checkout: TicketImageCheckout,
) => projectFiles.writeText(checkoutPath(shorthand), `${JSON.stringify(checkout, null, 2)}\n`);
