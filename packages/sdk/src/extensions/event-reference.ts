import type { RendererEventReference } from "pstdio-api-contracts/extension-kernel";

/** Resolve an event ref using the same ownership rules as commands and hooks. */
export const resolveEventReferenceId = (ref: RendererEventReference, ownerExtensionId?: string) => {
  if (typeof ref === "string") return ref;
  const extensionId = ref.extensionId ?? ownerExtensionId;
  if (!extensionId || extensionId === "pstdio") return ref.id;
  const lifecycle = /^(command\.(?:requested|started|completed|rejected|failed):)(.+)$/.exec(ref.id);
  if (lifecycle) return `${lifecycle[1]}${extensionId}.command.${lifecycle[2]}`;
  return `${extensionId}.event.${ref.id}`;
};
