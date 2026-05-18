import type { CommandExecuteRequest } from "@pstdio/sdk/api";
import type { ExtensionRepoContext, ExtensionResourceContext, ExtensionSlotKind } from "./types";

type BuildExtensionSlotContextInput = {
  projectId: string;
  slotId: string;
  kind: ExtensionSlotKind;
  resource?: ExtensionResourceContext;
};

type BuildExtensionCommandRequestInput = BuildExtensionSlotContextInput & {
  params?: Record<string, unknown>;
  repo?: ExtensionRepoContext;
};

export const buildExtensionSlotContext = (input: BuildExtensionSlotContextInput) => {
  const { projectId, slotId, kind, resource } = input;

  return {
    id: slotId,
    kind,
    context: {
      projectId,
      ...(resource ? { resourceType: resource.type, resourceId: resource.id } : {}),
    },
  };
};

export const buildExtensionCommandRequest = (input: BuildExtensionCommandRequestInput): CommandExecuteRequest => ({
  projectId: input.projectId,
  ...(input.params ? { params: input.params } : {}),
  ...(input.repo ? { repo: input.repo } : {}),
  ...(input.resource ? { resource: input.resource } : {}),
  slot: buildExtensionSlotContext(input),
  source: "dashboard",
});
