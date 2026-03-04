export const getTicketFileContent = async (baseUrl: string, ticketId: string, fileId: string) => {
  const res = await fetch(
    `${baseUrl}/v1/tickets/${encodeURIComponent(ticketId)}/files/${encodeURIComponent(fileId)}/content`,
  );

  if (!res.ok) throw new Error(`Failed to get ticket file content: ${res.status}`);

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
};
