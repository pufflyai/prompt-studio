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
  expect(
    metadata.resourceKinds.find((kind) => kind.id === "ticket" && kind.extensionId === "pstdio.pstdio-planner"),
  ).toMatchObject({ resolveManyCommand: "pstdio.pstdio-planner.command.resolve-ticket-resources" });
  const navigation = metadata.views.find((view) => view.id === "pstdio.pstdio-planner.view.ticket-files");
  expect(navigation?.body).toMatchObject({
    kind: "tree",
    structure: [
      { id: "ticket", resourceNode: { id: "__ticket__" } },
      { id: "files" },
      { id: "workspaces" },
      { id: "sessions" },
    ],
  });
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
  const rows = await execute("query-tickets", {});
  expect(
    (rows.outcome.value as unknown as { rows: { id: string; target?: unknown }[] }).rows.find(
      (row) => row.id === ticket.outcome.value.id,
    )?.target,
  ).toMatchObject({
    kind: "page",
    page: { id: "ticket" },
    resource: { id: ticket.outcome.value.id },
  });
  const file = await execute("create-ticket-file", { ticketId: ticket.outcome.value.id, name: "notes.md" });
  expect(file.outcome.ok).toBe(true);
  const link = await execute("document-link", { id: ticket.outcome.value.shorthand, file: "notes.md" });
  expect(link.outcome.ok).toBe(true);
  const url = new URL(link.outcome.value.href, baseUrl);
  expect(url.pathname).toBe(`/projects/${projectId}/extensions/pstdio.pstdio-planner/ticket`);
  expect(url.searchParams.get("document")).toBe(file.outcome.value.id);
  const tree = await execute("ticket-files.tree.body", {
    renderer: {
      rendererId: "pstdio.pstdio-planner.view.ticket-files",
      resource: { type: "ticket", id: ticket.outcome.value.id },
    },
  });
  expect(tree.outcome).toMatchObject({
    ok: true,
    value: expect.arrayContaining([
      expect.objectContaining({
        id: "files",
        nodes: expect.arrayContaining([
          expect.objectContaining({
            id: file.outcome.value.id,
            target: expect.objectContaining({
              resource: expect.objectContaining({
                label: "notes.md",
                metadata: expect.objectContaining({ documentId: file.outcome.value.id }),
              }),
              parent: expect.objectContaining({
                resource: expect.objectContaining({
                  id: ticket.outcome.value.id,
                  label: `${ticket.outcome.value.shorthand} Packaged document links`,
                }),
              }),
            }),
          }),
        ]),
      }),
    ]),
  });
  const resolved = await execute("resolve-ticket-resources", {
    resources: [{ type: "ticket", id: ticket.outcome.value.id, metadata: { documentId: file.outcome.value.id } }],
  });
  expect(resolved.outcome).toMatchObject({
    ok: true,
    value: [
      {
        resource: expect.objectContaining({ label: "notes.md" }),
        target: expect.objectContaining({
          parent: expect.objectContaining({ resource: expect.objectContaining({ id: ticket.outcome.value.id }) }),
        }),
      },
    ],
  });
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
