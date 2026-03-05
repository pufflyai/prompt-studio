export const setStartupLog = async (baseUrl: string, workspaceId: string, content: string) => {
  const content_base64 = Buffer.from(content).toString("base64");

  const res = await fetch(`${baseUrl}/v1/workspaces/${encodeURIComponent(workspaceId)}/startup-log`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ content_base64 }),
  });

  if (!res.ok) throw new Error(`Failed to upload startup log: ${res.status}`);

  return (await res.json()) as { file_id: string };
};
