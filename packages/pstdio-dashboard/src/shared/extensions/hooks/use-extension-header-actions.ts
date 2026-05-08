import { useParams } from "@tanstack/react-router";
import type { HeaderActionItem } from "@/features/plugin-actions/components/header-action-groups";
import { getSlotContributions } from "../contribution-mapping";
import { buildExtensionCommandRequest } from "../slot-context";
import type { ExtensionResourceContext } from "../types";
import { useExecuteExtensionCommand, useProjectExtensionMetadata } from "./use-project-extensions";

interface UseExtensionHeaderActionsInput {
  slotId: string;
  resource?: ExtensionResourceContext;
}

/**
 * Adapt extension menu contributions into the dashboard's `HeaderActionItem[]` shape so
 * pages that already render a `PluginHeaderActions` overflow can fold extension entries
 * into the same `…` menu instead of stacking a second one next to it.
 */
export const useExtensionHeaderActions = (input: UseExtensionHeaderActionsInput): HeaderActionItem[] => {
  const { slotId, resource } = input;
  const { projectId } = useParams({ strict: false });
  const { data } = useProjectExtensionMetadata(projectId);
  const executeCommand = useExecuteExtensionCommand(projectId);

  if (!projectId) return [];

  const contributions = getSlotContributions(data?.menuContributions ?? [], slotId);
  return contributions.map((contribution) => ({
    key: `extension:${contribution.id}`,
    label: contribution.label,
    kind: "default" as const,
    onClick: () =>
      executeCommand.mutate({
        commandId: contribution.commandId,
        body: buildExtensionCommandRequest({
          projectId,
          slotId,
          kind: "menu",
          params: contribution.params,
          resource,
        }),
      }),
  }));
};
