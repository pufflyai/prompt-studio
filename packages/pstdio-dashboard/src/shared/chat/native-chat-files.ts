/** Narrow the authenticated blob adapter to files this native provider may display. */
export const nativeChatFileAllowed = (url: string, projectId?: string, extensionId?: string) => {
  if (!projectId || !url.startsWith("/v1/") || /[?#]/.test(url)) return false;
  const parts = url.split("/");
  const fileId = parts.at(-2);
  if (!fileId || fileId === "." || fileId === "..") return false;
  try {
    const decoded = decodeURIComponent(fileId);
    if (decoded === "." || decoded === ".." || /[\\/]/.test(decoded)) return false;
  } catch {
    return false;
  }
  const root = `/v1/projects/${encodeURIComponent(projectId)}`;
  return (
    url === `${root}/session-attachments/${fileId}/content` ||
    Boolean(extensionId && url === `${root}/extensions/${encodeURIComponent(extensionId)}/files/${fileId}/content`)
  );
};
