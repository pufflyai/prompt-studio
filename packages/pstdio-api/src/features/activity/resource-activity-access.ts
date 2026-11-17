import type { ResourceActivityCapabilities } from "pstdio-api-contracts";
import type { CommandRef, ResourceRef } from "pstdio-api-contracts/extension-kernel";
import { canonicalResource } from "../extensions/command-environment/resource-link-policy";
import { resolveResources } from "../extensions/command-environment/resource-resolution";
import type { ExtensionsRouteDeps } from "../extensions/deps";
import { executeProjectExtensionCommand } from "../extensions/execute-project-extension-command";

export type ActivityOperation = "read" | "comment" | "change" | "outcome" | "resolve" | "attach" | "handoff";
export const runActivityOwnerCommand = async (
  deps: ExtensionsRouteDeps,
  resource: ResourceRef & { projectId: string; extensionId: string },
  command: CommandRef,
  params: Record<string, unknown>,
) => {
  if (command.extensionId && command.extensionId !== resource.extensionId)
    throw new Error("Activity commands must belong to the resource owner.");
  const result = await executeProjectExtensionCommand(deps, {
    projectId: resource.projectId,
    commandId: `${resource.extensionId}.command.${command.id}`,
    body: { params, resource, source: "api" },
  });
  if (!result.outcome.ok) throw new Error(result.outcome.reason);
  return result.outcome.value;
};
export const resourceActivityAccess = async (
  deps: ExtensionsRouteDeps,
  input: { projectId: string; extensionId?: string },
  resource: ResourceRef,
  operation: ActivityOperation,
) => {
  const ref = await canonicalResource(deps, input, resource);
  const { runtime } = await deps.extensionRuntimeCatalog.get(input.projectId);
  const declaration = runtime.resourceKinds.find(
    (kind) => kind.extensionId === ref.extensionId && kind.localId === ref.type,
  )?.contribution;
  const capabilities: ResourceActivityCapabilities | undefined = declaration?.activity;
  if (ref.device || !capabilities || !Object.values(capabilities).some(Boolean)) return null;
  const required =
    operation === "comment" || operation === "resolve" || operation === "handoff" ? "comments" : undefined;
  if (required && !capabilities[required]) throw new Error("This resource does not support discussion.");
  if (operation === "change" && (!capabilities.changes || input.extensionId !== ref.extensionId))
    throw new Error("Only the resource owner can publish changes.");
  if (operation === "outcome" && !capabilities.outcomes)
    throw new Error("This resource does not support work outcomes.");
  const resolved = await resolveResources(
    deps,
    input.extensionId ? { ...input, extensionId: input.extensionId } : { ...input, extensionId: ref.extensionId },
    [ref],
  );
  if (!resolved.length) throw new Error("Resource not found or unavailable.");
  if (declaration?.authorizeActivity) {
    const verdict = (await runActivityOwnerCommand(deps, ref, declaration.authorizeActivity, {
      operation,
      resource: ref,
    })) as { allowed?: boolean; reason?: string };
    if (verdict?.allowed !== true) throw new Error(verdict?.reason ?? "Activity access denied by the resource owner.");
  }
  return { resource: ref, capabilities, declaration };
};
