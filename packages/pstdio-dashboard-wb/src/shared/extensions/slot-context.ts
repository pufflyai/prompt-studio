import type { CommandExecuteRequest } from "@pstdio/sdk/api";
import type {
  ExtensionAttachmentContext,
  ExtensionRepoContext,
  ExtensionResourceContext,
  ExtensionSlotKind,
} from "./types";

interface BuildExtensionSlotContextInput {
  projectId: string;
  slotId: string;
  kind: ExtensionSlotKind;
  resource?: ExtensionResourceContext;
}

interface BuildExtensionCommandRequestInput extends BuildExtensionSlotContextInput {
  attachment?: Omit<ExtensionAttachmentContext, "projectId" | "resource">;
  params?: Record<string, unknown>;
  repo?: ExtensionRepoContext;
}

export const buildExtensionSlotContext = (input: BuildExtensionSlotContextInput) => {
  const { kind, projectId, resource, slotId } = input;

  return {
    id: slotId,
    kind,
    context: {
      projectId,
      ...(resource ? { resourceType: resource.type, resourceId: resource.id } : {}),
    },
  };
};

export const buildExtensionAttachmentContext = (
  input: BuildExtensionCommandRequestInput,
): ExtensionAttachmentContext | undefined => {
  if (!input.attachment) return undefined;
  return {
    ...input.attachment,
    projectId: input.projectId,
    ...(input.resource ? { resource: input.resource } : {}),
  };
};

export const buildExtensionCommandRequest = (input: BuildExtensionCommandRequestInput): CommandExecuteRequest => ({
  projectId: input.projectId,
  ...(input.params ? { params: input.params } : {}),
  ...(input.repo ? { repo: input.repo } : {}),
  ...(input.resource ? { resource: input.resource } : {}),
  ...(input.attachment ? { attachment: buildExtensionAttachmentContext(input) } : {}),
  slot: buildExtensionSlotContext(input),
  source: "dashboard",
});
