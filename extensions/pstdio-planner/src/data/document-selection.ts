export const TICKET_BODY_DOCUMENT = "__ticket__";

export const selectedDocumentFromResource = (resource: { metadata?: Record<string, unknown> } | undefined) => {
  const documentId = resource?.metadata?.documentId;
  return typeof documentId === "string" ? documentId : TICKET_BODY_DOCUMENT;
};
