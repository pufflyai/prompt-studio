import { canonicalExtensionId } from "pstdio-api-contracts/extension-host";
import type { ExtensionResourcesApi } from "pstdio-api-contracts/extension-kernel";
import { createReadBoundary, resourceChangeProviders } from "pstdio-extensions";
import { issueReceipt } from "../../activity/change-receipt";
import { admitChangeResource } from "../../activity/change-resource";
import { seenOwnerId } from "../../activity/resource-seen";
import { resolveResourceOpenings } from "../../projects/resource-openers";
import type { ExtensionsRouteDeps } from "../deps";
import { createResourceLinksApi } from "./resource-links";
import { resolveResources } from "./resource-resolution";

// The kind's declared prefix, or the project shorthand when the kind uses the project's.
const allocationPrefix = async (
  deps: ExtensionsRouteDeps,
  input: { projectId: string; extensionId: string },
  kind: string,
) => {
  const { runtime, project } = await deps.extensionRuntimeCatalog.get(input.projectId);
  const declaration = runtime.resourceKinds.find(
    (record) => record.extensionId === input.extensionId && record.localId === kind,
  );
  const prefix = declaration?.contribution.prefix;
  if (prefix === undefined)
    throw new Error(`Resource kind "${kind}" has no allocation prefix in ${input.extensionId}.`);
  const resolved = typeof prefix === "string" ? prefix : project.shorthand;
  if (!/^[A-Z][A-Z0-9]{0,15}$/.test(resolved) || resolved === "WS")
    throw new Error(`Resource prefix "${resolved}" is invalid or reserved.`);
  return resolved;
};

const readOwnedKind = async <T>(
  deps: ExtensionsRouteDeps,
  input: { projectId: string; extensionId: string; signal?: AbortSignal },
  kind: string,
  load: () => Promise<T>,
) => {
  const read = createReadBoundary(input.signal);
  const { runtime } = await read(() => deps.extensionRuntimeCatalog.get(input.projectId));
  if (!runtime.resourceKinds.some((record) => record.extensionId === input.extensionId && record.localId === kind))
    throw new Error(`Resource kind "${kind}" is not owned by ${input.extensionId}.`);
  return read(load);
};

export const createResourcesApi = (
  deps: ExtensionsRouteDeps,
  input: { projectId: string; extensionId: string; signal?: AbortSignal; resourceLinksReadOnly?: boolean },
): ExtensionResourcesApi => {
  // Each invocation retains its original reader, including a long-lived viewer stream.
  let reader: Promise<string>;
  try {
    reader = deps.accountService.status().then((status) => seenOwnerId(status.login));
  } catch (error) {
    // A failed optional observation capability must not disable unrelated resource APIs.
    reader = Promise.reject(error);
  }
  void reader.catch(() => undefined);
  return {
    observeChange: async (ref, stamp) => {
      if (ref.projectId && ref.projectId !== input.projectId) throw new Error("Resource belongs to another project.");
      const principal = await reader;
      input.signal?.throwIfAborted();
      const resource = await admitChangeResource(
        deps,
        input.projectId,
        ref,
        canonicalExtensionId(ref.extensionId ?? input.extensionId),
        input.signal,
      );
      if (!resource) throw new Error("Resource is unavailable.");
      const { runtime } = await deps.extensionRuntimeCatalog.get(input.projectId);
      const registration = resourceChangeProviders(runtime).find(
        (k) => k.extensionId === resource.extensionId && k.type === resource.type && k.provider === input.extensionId,
      );
      if (!registration) throw new Error("This extension does not provide changes for the resource.");
      input.signal?.throwIfAborted();
      if (principal !== seenOwnerId((await deps.accountService.status()).login)) throw new Error("Reader changed.");
      if ((await deps.extensionRuntimeCatalog.get(input.projectId)).runtime !== runtime)
        throw new Error("Resource provider changed during the read.");
      return issueReceipt({
        resource,
        stamp,
        provider: registration.heads,
        principal,
      });
    },
    resolveMany: (resources) => resolveResources(deps, input, resources),
    resolveOpenings: (resources) => resolveResourceOpenings(deps, input, resources),
    ...createResourceLinksApi(deps, input),
    removed: async (resource) => {
      if (resource.projectId && resource.projectId !== input.projectId)
        throw new Error("Resource belongs to another project.");
      if (resource.extensionId && canonicalExtensionId(resource.extensionId) !== input.extensionId)
        throw new Error("Resource belongs to another extension.");
      const { runtime } = await deps.extensionRuntimeCatalog.get(input.projectId);
      const declaration = runtime.resourceKinds.find(
        (record) => record.extensionId === input.extensionId && record.localId === resource.type,
      );
      if (!declaration) throw new Error(`Resource kind "${resource.type}" is not owned by ${input.extensionId}.`);
      await createResourceLinksApi(deps, input).removedLinks({
        ...resource,
        extensionId: input.extensionId,
        projectId: input.projectId,
      });
      deps.eventBus.emit("resource_events", "set", {
        id: crypto.randomUUID(),
        resource: { ...resource, extensionId: input.extensionId, projectId: input.projectId },
      });
    },
    identity: ({ kind, id }) =>
      readOwnedKind(deps, input, kind, () => deps.extensionResourceSequencesService.identity({ ...input, kind, id })),
    identityMany: ({ kind, ids }) =>
      readOwnedKind(deps, input, kind, () =>
        deps.extensionResourceSequencesService.identityMany({ ...input, kind, ids }),
      ),
    findByShorthand: ({ kind, shorthand }) =>
      readOwnedKind(deps, input, kind, () =>
        deps.extensionResourceSequencesService.findByShorthand({ ...input, kind, shorthand }),
      ),
    allocate: async ({ kind, idPrefix }) =>
      deps.extensionResourceSequencesService.allocate({
        ...input,
        kind,
        prefix: await allocationPrefix(deps, input, kind),
        idPrefix,
      }),
    allocateMany: async ({ kind, count, idPrefix }) =>
      deps.extensionResourceSequencesService.allocateMany({
        ...input,
        kind,
        count,
        prefix: await allocationPrefix(deps, input, kind),
        idPrefix,
      }),
  };
};
