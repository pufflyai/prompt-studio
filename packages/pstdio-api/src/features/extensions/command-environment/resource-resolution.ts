import { extensionResourceRefSchema } from "pstdio-api-contracts";
import {
  isNavigationTarget,
  qualifyNavigationTarget,
  type ResourceRef,
  type ResourceResolution,
  resourceKey,
  workbenchPages,
} from "pstdio-api-contracts/extension-kernel";
import { createReadBoundary, type ExtensionRuntime, isRuntimeNavigationTargetAvailable } from "pstdio-extensions";
import type { ExtensionsRouteDeps } from "../deps";
import { executeProjectExtensionCommand } from "../execute-project-extension-command";
import { canonicalResource } from "./resource-link-policy";

const resolveHostResource = async (deps: ExtensionsRouteDeps, ref: ResourceRef, signal?: AbortSignal) => {
  const read = createReadBoundary(signal);
  // Personal history pointers keep their saved identity without exposing another device's data.
  if (ref.device) return;
  const record = ref.type === "workspace" ? await read(() => deps.workspaceService.get(ref.id)) : undefined;
  if (record && record.project_id === ref.projectId) {
    const resource = {
      ...ref,
      label: record.name || record.workspace_shorthand,
      icon: "folder",
      metadata: {
        ...ref.metadata,
        workspaceId: record.id,
        workspaceIsDefault: record.is_default,
        workspaceReadOnly: false,
        workspaceExecutionKind: record.execution_kind,
        workspaceProviderState: record.provider_state,
        workspaceSupportsFiles:
          record.execution_kind === "local" && record.provider_capabilities_json?.files !== "none",
        workspaceSupportsDiff: !record.is_default && record.provider_capabilities_json?.diff === true,
        workspaceType: record.provider_id === "pstdio.worktree" ? "worktree" : "folder",
        workspaceError: record.setup_error,
      },
    };
    return { resource };
  }
  if (ref.type === "session") {
    const session = await read(() => deps.sessionService.get(ref.id));
    if (!session || session.project_id !== ref.projectId) return;
    const resource = { ...ref, label: session.title || session.id, icon: "message-circle" };
    return { resource, target: { kind: "page" as const, page: workbenchPages.session, resource } };
  }
};

const ownerResolutions = (batch: ResourceRef[], value: unknown, runtime: ExtensionRuntime) => {
  const owner = batch[0]!;
  if (!Array.isArray(value)) return [];
  const results = new Map<string, ResourceResolution>();
  const allowed = new Set(batch.map(resourceKey));
  for (const item of value) {
    const parsed = extensionResourceRefSchema.safeParse(item?.resource);
    if (!parsed.success) continue;
    const resource = {
      ...parsed.data,
      extensionId: parsed.data.extensionId ?? owner.extensionId,
      projectId: parsed.data.projectId ?? owner.projectId,
    };
    const key = resourceKey(resource);
    if (!allowed.has(key)) continue;
    const target = isNavigationTarget(item.target)
      ? qualifyNavigationTarget(item.target, owner.extensionId!, owner.projectId)
      : undefined;
    results.set(key, {
      resource,
      ...(target && isRuntimeNavigationTargetAvailable(runtime, target)
        ? { target: target as ResourceResolution["target"] }
        : {}),
    });
  }
  return [...results.values()];
};

export const resolveResourceRecords = async (
  deps: ExtensionsRouteDeps,
  input: { projectId: string; extensionId?: string; signal?: AbortSignal; resourceLinksReadOnly?: boolean },
  resources: ResourceRef[],
) => {
  const read = createReadBoundary(input.signal);
  input.signal?.throwIfAborted();
  if (!Array.isArray(resources) || resources.length > 100) throw new Error("Resolve at most 100 resources.");
  const refs = await Promise.all(
    resources.map((ref) => canonicalResource(deps, input, extensionResourceRefSchema.parse(ref))),
  );
  const requested = new Map(refs.map((ref) => [resourceKey(ref), ref]));
  const { runtime } = await read(() => deps.extensionRuntimeCatalog.get(input.projectId));
  const groups = new Map<string, ResourceRef[]>();
  const resolved: ResourceResolution[] = [];
  for (const ref of requested.values()) {
    if (ref.extensionId === "pstdio") {
      const host = await read(() => resolveHostResource(deps, ref, input.signal));
      if (host) resolved.push(host);
      continue;
    }
    const kind = runtime.resourceKinds.find(
      (kind) => kind.extensionId === ref.extensionId && kind.localId === ref.type,
    );
    const resolver = kind?.contribution.resolveMany;
    if (!resolver || (resolver.extensionId && resolver.extensionId !== ref.extensionId)) continue;
    const commandId = `${ref.extensionId}.command.${resolver.id}`;
    const batch = groups.get(commandId) ?? [];
    batch.push(ref);
    groups.set(commandId, batch);
  }
  const batches = await Promise.all(
    [...groups].map(async ([commandId, batch]) => {
      let value: unknown;
      try {
        const response = await executeProjectExtensionCommand(deps, {
          projectId: input.projectId,
          commandId,
          signal: input.signal,
          resourceLinksReadOnly: input.resourceLinksReadOnly,
          body: { params: { resources: batch }, source: "api" },
        });
        value = response.outcome.ok ? response.outcome.value : undefined;
      } catch {
        input.signal?.throwIfAborted();
        return [];
      }
      return ownerResolutions(batch, value, runtime);
    }),
  );
  input.signal?.throwIfAborted();
  return { requested: [...requested.values()], resolved: [...resolved, ...batches.flat()] };
};

export const resolveResources = async (
  deps: ExtensionsRouteDeps,
  input: { projectId: string; extensionId?: string; signal?: AbortSignal; resourceLinksReadOnly?: boolean },
  resources: ResourceRef[],
) => (await resolveResourceRecords(deps, input, resources)).resolved;
