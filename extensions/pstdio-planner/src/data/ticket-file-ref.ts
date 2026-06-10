// A ticket file (or image attachment) is addressed as its own `ticket-file`
// resource. The resource id packs the owning ticket id and the entry id so the
// file renderer's load/save commands can resolve both from `ctx.resource.id`.

const SEPARATOR = "/";

export const ticketFileResourceId = (ticketId: string, entryId: string) => `${ticketId}${SEPARATOR}${entryId}`;

export const parseTicketFileResourceId = (raw: string | undefined) => {
  if (!raw) return null;
  const separator = raw.indexOf(SEPARATOR);
  if (separator < 0) return null;
  return { ticketId: raw.slice(0, separator), entryId: raw.slice(separator + SEPARATOR.length) };
};
