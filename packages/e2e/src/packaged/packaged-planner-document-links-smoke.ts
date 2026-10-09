import { expect } from "bun:test";
import type { WorkbenchExtensionMetadata } from "pstdio-api-contracts";

export const expectPlannerDocumentLinks = async (
  baseUrl: string,
  projectId: string,
  headers: Record<string, string>,
  metadata: WorkbenchExtensionMetadata,
) => {
  const page = metadata.pages.find((page) => page.id === "pstdio.pstdio-planner.page.ticket");
  expect(page).toMatchObject({ document: { metadataKey: "documentId" } });
  const execute = async (name: string, params: Record<string, unknown>, resource?: Record<string, unknown>) => {
    const response = await fetch(
      `${baseUrl}/v1/projects/${projectId}/extensions/commands/pstdio.pstdio-planner.command.${name}/execute`,
      {
        method: "POST",
        headers: { ...headers, "content-type": "application/json" },
        body: JSON.stringify({ source: "api", params, resource }),
      },
    );
    expect(response.status).toBe(200);
    return (await response.json()) as { outcome: { ok: boolean; value: Record<string, string> } };
  };
  const ticket = await execute("create-ticket", { title: "Packaged document links" });
  expect(ticket.outcome.ok).toBe(true);
  const file = await execute("create-ticket-file", { ticketId: ticket.outcome.value.id, name: "notes.md" });
  expect(file.outcome.ok).toBe(true);
  const link = await execute("document-link", { id: ticket.outcome.value.shorthand, file: "notes.md" });
  expect(link.outcome.ok).toBe(true);
  const url = new URL(link.outcome.value.href, baseUrl);
  expect(url.pathname).toBe(`/projects/${projectId}/extensions/pstdio.pstdio-planner/ticket`);
  expect(url.searchParams.get("document")).toBe(file.outcome.value.id);
  await execute("delete-ticket-file", { ticketId: ticket.outcome.value.id, fileId: file.outcome.value.id });
  const missing = await execute(
    "get-ticket-content",
    {},
    {
      type: "ticket",
      id: ticket.outcome.value.id,
      metadata: { documentId: file.outcome.value.id },
    },
  );
  expect(missing.outcome.ok).toBe(false);
};
