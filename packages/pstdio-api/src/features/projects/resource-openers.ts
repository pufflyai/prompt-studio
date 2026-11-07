import { commandRefId } from "@pstdio/sdk/extensions";
import type { ResourceOpener, ResourceRef } from "pstdio-api-contracts";
import {
  isNavigationTarget,
  type NavigationTarget,
  qualifyNavigationTarget,
  resourceKey,
} from "pstdio-api-contracts/extension-kernel";
import { isRuntimeNavigationTargetAvailable } from "pstdio-extensions";
import { resolveResourceRecords } from "../extensions/command-environment/resource-resolution";
import type { ExtensionsRouteDeps } from "../extensions/deps";
import { executeProjectExtensionCommand } from "../extensions/execute-project-extension-command";
import { readProjectComposition } from "./project-composition";

interface OpeningContext {
  projectId: string;
  extensionId?: string;
  signal?: AbortSignal;
}
const bindingFor = (bindings: ResourceOpener[], resource: ResourceRef) =>
  bindings.find(
    ({ resourceKind }) => resourceKind.extensionId === resource.extensionId && resourceKind.id === resource.type,
  );
const inProject = (target: NavigationTarget, projectId: string) => {
  const pending: NavigationTarget[] = [target];
  while (pending.length) {
    const item = pending.pop()!;
    if (item.kind === "compound") pending.push(...item.targets);
    else {
      if (item.kind !== "page" && item.kind !== "panel") return false;
      if (item.resource?.projectId && item.resource.projectId !== projectId) return false;
      if (item.kind === "page" && item.parent) pending.push(item.parent);
    }
  }
  return true;
};
const resolveOpening = async (
  deps: ExtensionsRouteDeps,
  input: OpeningContext,
  resource: ResourceRef,
  binding: ResourceOpener | undefined,
) => {
  if (!binding) return undefined;
  const { opener } = binding;
  let value: unknown;
  if (opener.kind === "page") value = { kind: "page", page: opener, resource };
  else {
    const commandId = commandRefId(opener);
    const { runtime } = await deps.extensionRuntimeCatalog.get(input.projectId);
    if (!runtime.commands.some((command) => command.id === commandId)) return undefined;
    try {
      const response = await executeProjectExtensionCommand(deps, {
        projectId: input.projectId,
        commandId,
        signal: input.signal,
        body: { source: "api", resource },
      });
      if (response.outcome.ok) value = response.outcome.value;
    } catch {
      input.signal?.throwIfAborted();
      return undefined;
    }
  }
  if (!isNavigationTarget(value)) return undefined;
  const target = qualifyNavigationTarget(value, opener.extensionId, input.projectId);
  if (target.kind !== "page" && target.kind !== "panel" && target.kind !== "compound") return undefined;
  return inProject(target, input.projectId) ? target : undefined;
};

export const resolveResourceOpenings = async (
  deps: ExtensionsRouteDeps,
  input: OpeningContext,
  resources: ResourceRef[],
) => {
  const { requested, resolved } = await resolveResourceRecords(deps, input, resources);
  const composition = await readProjectComposition(deps, input.projectId);
  const { runtime } = await deps.extensionRuntimeCatalog.get(input.projectId);
  const records = new Map(resolved.map((entry) => [resourceKey(entry.resource), entry.resource]));
  // Data owners can decorate references. An ordinary kind needs no batch resolver just to have an opener.
  for (const resource of requested) {
    if (records.has(resourceKey(resource))) continue;
    const kind = runtime.resourceKinds.find(
      (kind) => kind.extensionId === resource.extensionId && kind.localId === resource.type,
    );
    if (resource.device || (kind && !kind.contribution.resolveMany)) records.set(resourceKey(resource), resource);
  }
  const candidates = await Promise.all(
    [...records.values()].map(async (resource) => {
      const binding = bindingFor(composition.resourceOpeners, resource);
      return { resource, binding, target: await resolveOpening(deps, input, resource, binding) };
    }),
  );
  input.signal?.throwIfAborted();
  const current = await readProjectComposition(deps, input.projectId);
  const snapshot = await deps.extensionRuntimeCatalog.get(input.projectId);
  return candidates.map(({ resource, binding, target }) => {
    const selected = bindingFor(current.resourceOpeners, resource)?.opener;
    const unchanged =
      selected &&
      binding &&
      selected.kind === binding.opener.kind &&
      selected.extensionId === binding.opener.extensionId &&
      selected.id === binding.opener.id;
    return {
      resource,
      ...(target && unchanged && isRuntimeNavigationTargetAvailable(snapshot.runtime, target) ? { target } : {}),
    };
  });
};
