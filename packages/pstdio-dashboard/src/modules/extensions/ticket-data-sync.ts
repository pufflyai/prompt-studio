import type { ExecuteDashboardExtensionCommand } from "./extension-command-handler";

interface TicketDataMetadata {
  dataRenderers?: Array<{ id: string; queryCommandId: string; resourceKind?: string }>;
}

export const syncTicketData = async (input: {
  executeCommand: ExecuteDashboardExtensionCommand;
  metadata: TicketDataMetadata;
  projectId: string;
}) => {
  const renderer = input.metadata.dataRenderers?.find((candidate) => candidate.resourceKind === "ticket");
  if (!renderer) return;

  await input.executeCommand(input.projectId, renderer.queryCommandId, {
    projectId: input.projectId,
    source: "dashboard",
    metadata: { dataRendererId: renderer.id },
  });
};
