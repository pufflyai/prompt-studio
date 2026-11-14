import { commandRefId } from "@pstdio/sdk/extensions";
import type { ResourceOpener, ResourceRef } from "pstdio-api-contracts";
import {
  isNavigationTarget,
  type NavigationTarget,
  qualifyNavigationTarget,
  resourceKey,
} from "pstdio-api-contracts/extension-kernel";
import { createReadBoundary, type ExtensionRuntime, isRuntimeNavigationTargetAvailable } from "pstdio-extensions";
import { canonicalResource, ResourceReferenceError } from "../extensions/command-environment/resource-link-policy";
import { resolveResourceRecords } from "../extensions/command-environment/resource-resolution";
import type { ExtensionsRouteDeps } from "../extensions/deps";
import { executeProjectExtensionCommand } from "../extensions/execute-project-extension-command";
import { readProjectComposition } from "./project-composition";

interface OpeningContext {
  projectId: string;
  extensionId?: string;
  signal?: AbortSignal;
  resourceLinksReadOnly?: boolean;
}
const bindingFor = (bindings: ResourceOpener[], resource: ResourceRef) =>
  bindings.find(
    ({ resourceKind }) => resourceKind.extensionId === resource.extensionId && resourceKind.id === resource.type,
  );
const openingItems = (target: NavigationTarget) => {
  const pending: NavigationTarget[] = [target];
  const items: Extract<NavigationTarget, { kind: "page" | "panel" }>[] = [];
  while (pending.length) {
    const item = pending.pop()!;
    if (item.kind === "compound") pending.push(...item.targets);
    else if (item.kind === "page" || item.kind === "panel") {
      items.push(item);
      if (item.kind === "page" && item.parent) pending.push(item.parent);
    } else return undefined;
  }
  return items;
};
const isResourceAvailable = (runtime: ExtensionRuntime, resource: ResourceRef) =>
  resource.extensionId === "pstdio" ||
  runtime.resourceKinds.some((kind) => kind.extensionId === resource.extensionId && kind.localId === resource.type);
const isOpeningAvailable = (runtime: ExtensionRuntime, target: NavigationTarget) =>
  openingItems(target)?.every((item) => !item.resource || isResourceAvailable(runtime, item.resource)) &&
  isRuntimeNavigationTargetAvailable(runtime, target);
const canonicalOpeningTarget = async (
  deps: ExtensionsRouteDeps,
  input: OpeningContext,
  requested: NavigationTarget,
  extensionId: string,
) => {
  const sources = openingItems(requested);
  if (!sources) return undefined;
  const target = qualifyNavigationTarget(requested, extensionId, input.projectId);
  if (target.kind !== "page" && target.kind !== "panel" && target.kind !== "compound") return undefined;
  const items = openingItems(target)!;
  const read = createReadBoundary(input.signal);
  try {
    await Promise.all(
      items.map(async (item, index) => {
        const resource = sources[index]!.resource;
        if (resource) item.resource = await read(() => canonicalResource(deps, { ...input, extensionId }, resource));
      }),
    );
  } catch (error) {
    if (error instanceof ResourceReferenceError) return undefined;
    throw error;
  }
  return target;
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
    const { runtime } = await createReadBoundary(input.signal)(() => deps.extensionRuntimeCatalog.get(input.projectId));
    if (!runtime.commands.some((command) => command.id === commandId)) return undefined;
    try {
      const response = await executeProjectExtensionCommand(deps, {
        projectId: input.projectId,
        commandId,
        signal: input.signal,
        resourceLinksReadOnly: input.resourceLinksReadOnly,
        body: { source: "api", resource },
      });
      if (response.outcome.ok) value = response.outcome.value;
    } catch {
      input.signal?.throwIfAborted();
      return undefined;
    }
  }
  if (!isNavigationTarget(value)) return undefined;
  return canonicalOpeningTarget(deps, input, value, opener.extensionId);
};

export const resolveResourceOpenings = async (
  deps: ExtensionsRouteDeps,
  input: OpeningContext,
  resources: ResourceRef[],
) => {
  const read = createReadBoundary(input.signal);
  const { requested, resolved } = await read(() => resolveResourceRecords(deps, input, resources));
  const composition = await read(() => readProjectComposition(deps, input.projectId));
  const { runtime } = await read(() => deps.extensionRuntimeCatalog.get(input.projectId));
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
  const current = await read(() => readProjectComposition(deps, input.projectId));
  const snapshot = await read(() => deps.extensionRuntimeCatalog.get(input.projectId));
  return candidates.map(({ resource, binding, target }) => {
    const selected = bindingFor(current.resourceOpeners, resource)?.opener;
    const unchanged =
      selected &&
      binding &&
      selected.kind === binding.opener.kind &&
      selected.extensionId === binding.opener.extensionId &&
      selected.id === binding.opener.id &&
      (selected.kind !== "command" ||
        snapshot.runtime.commands.some((command) => command.id === commandRefId(selected)));
    const available = isResourceAvailable(snapshot.runtime, resource);
    return {
      resource,
      ...(target && unchanged && available && isOpeningAvailable(snapshot.runtime, target) ? { target } : {}),
    };
  });
};
