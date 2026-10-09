import { expect } from "bun:test";
import type { WorkbenchExtensionMetadata } from "pstdio-api-contracts";
import { expectPlannerArchiveFilters } from "./packaged-planner-archive-filter-smoke";
import { expectPlannerDocumentLinks } from "./packaged-planner-document-links-smoke";

export const expectPlannerCommands = async (
  baseUrl: string,
  projectId: string,
  headers: Record<string, string>,
  metadata: WorkbenchExtensionMetadata,
) => {
  const commandId = "pstdio.pstdio-planner.command.open-tickets";
  expect(metadata.commands).toContainEqual(expect.objectContaining({ id: commandId }));
  expect(metadata.commandPaletteContributions).toContainEqual(expect.objectContaining({ commandId }));
  const refineTicket = metadata.commands.find((command) => command.id.endsWith(".command.refine-ticket"));
  expect(refineTicket?.params?.template).toEqual({
    type: "template",
    label: "Ticket template",
    required: false,
    templateType: "pstdio.pstdio-planner.template-type.ticket",
  });
  const response = await fetch(`${baseUrl}/v1/projects/${projectId}/extensions/commands/${commandId}/execute`, {
    method: "POST",
    headers: { ...headers, "content-type": "application/json" },
    body: JSON.stringify({ source: "dashboard", params: {} }),
  });
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({
    outcome: {
      status: "success",
      navigationRequests: [
        { kind: "page", page: { kind: "page", id: "tickets", extensionId: "pstdio.pstdio-planner" } },
      ],
    },
  });
  await expectPlannerArchiveFilters(baseUrl, projectId, headers);
  await expectPlannerDocumentLinks(baseUrl, projectId, headers, metadata);
};
