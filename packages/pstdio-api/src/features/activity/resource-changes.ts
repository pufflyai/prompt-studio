import { changeHeadSchema, changeStampSchema, extensionResourceRefSchema } from "pstdio-api-contracts";
import { canonicalExtensionId } from "pstdio-api-contracts/extension-host";
import { type ResourceRef, resourceKey } from "pstdio-api-contracts/extension-kernel";
import { resourceChangeProviders } from "pstdio-extensions";
import { z } from "zod";
import { resolveResources } from "../extensions/command-environment/resource-resolution";
import type { ExtensionsRouteDeps } from "../extensions/deps";
import { executeProjectExtensionCommand } from "../extensions/execute-project-extension-command";
import { issueReceipt, unseal } from "./change-receipt";
import { admitChangeResource } from "./change-resource";
import { openSeenStore, seenOwnerId } from "./resource-seen";

const batch = z.array(extensionResourceRefSchema).max(50);
export const createResourceChanges = (deps: ExtensionsRouteDeps, projectId: string, signal?: AbortSignal) => {
  const principal = async () => seenOwnerId((await deps.accountService.status()).login);
  const run = async (commandId: string, params: Record<string, unknown>, resource?: ResourceRef) => {
    const result = await executeProjectExtensionCommand(deps, {
      projectId,
      commandId,
      signal,
      body: { source: "api", resource, params },
    });
    if (!result.outcome.ok) throw new Error(result.outcome.reason);
    return result.outcome.value;
  };
  const groups = async (input: ResourceRef[]) => {
    const { runtime } = await deps.extensionRuntimeCatalog.get(projectId);
    const providers = resourceChangeProviders(runtime);
    const found = new Map<string, { heads: string; read: string; resources: Map<string, ResourceRef> }>();
    for (const raw of batch.parse(input)) {
      const owner = raw.extensionId ? canonicalExtensionId(raw.extensionId) : undefined;
      const candidates = providers.filter((k) => k.type === raw.type && (!owner || k.extensionId === owner));
      if (candidates.length !== 1) continue;
      const { extensionId, heads, read } = candidates[0]!;
      const ref = await admitChangeResource(deps, projectId, raw, extensionId, signal);
      if (!ref) continue;
      const key = JSON.stringify([heads, read, ref.type]);
      const group = found.get(key) ?? { heads, read, resources: new Map<string, ResourceRef>() };
      group.resources.set(resourceKey(ref), ref);
      found.set(key, group);
    }
    return Promise.all(
      [...found.values()].map(async (group) => {
        let refs = [...group.resources.values()];
        if (refs[0]?.extensionId !== "pstdio") {
          const readable = new Set(
            (await resolveResources(deps, { projectId, signal, strict: true }, refs)).map((item) =>
              resourceKey(item.resource),
            ),
          );
          refs = refs.filter((ref) => readable.has(resourceKey(ref)));
        }
        return { ...group, refs, runtime };
      }),
    );
  };
  const resolve = async (refs: ResourceRef[]) => {
    const results = await Promise.all(
      (await groups(refs)).map(async (group) => {
        if (!group.refs.length) return [];
        const allowed = new Map(group.refs.map((ref) => [resourceKey(ref), ref]));
        const result = z
          .array(changeHeadSchema)
          .max(50)
          .parse(await run(group.heads, { resources: group.refs }));
        if ((await deps.extensionRuntimeCatalog.get(projectId)).runtime !== group.runtime)
          throw new Error("Resource provider changed during the read.");
        return result.flatMap(({ resource, stamp }) => {
          const ref = allowed.get(resourceKey(resource));
          return ref ? [{ resource: ref, stamp, provider: group.heads }] : [];
        });
      }),
    );
    signal?.throwIfAborted();
    return results.flat();
  };
  return {
    async query(refs: ResourceRef[]) {
      const store = await openSeenStore(deps, projectId);
      const result = await store.query(await resolve(refs));
      if (store.principal !== (await principal())) throw new Error("Reader changed.");
      return result;
    },
    async read(resource: ResourceRef) {
      const store = await openSeenStore(deps, projectId);
      const [group] = await groups([resource]);
      if (!group?.refs[0]) throw new Error("Resource is unavailable.");
      const result = z
        .object({ content: z.json(), stamp: changeStampSchema })
        .parse(await run(group.read, {}, group.refs[0]));
      if (store.principal !== (await principal())) throw new Error("Reader changed.");
      if ((await deps.extensionRuntimeCatalog.get(projectId)).runtime !== group.runtime)
        throw new Error("Resource provider changed during the read.");
      return {
        ...result,
        receipt: issueReceipt({
          resource: group.refs[0],
          stamp: result.stamp,
          provider: group.heads,
          principal: store.principal,
        }),
      };
    },
    async acknowledge(receipt: string, resource?: ResourceRef) {
      const observation = unseal(receipt);
      if (resource && resourceKey(resource) !== resourceKey(observation.resource))
        throw new Error("Observation belongs to a different resource.");
      const store = await openSeenStore(deps, projectId);
      if (store.principal !== observation.principal) throw new Error("Observation belongs to a different reader.");
      const [head] = await resolve([observation.resource]);
      if (
        !head ||
        head.provider !== observation.provider ||
        head.stamp.lineage !== observation.stamp.lineage ||
        BigInt(head.stamp.revision) < BigInt(observation.stamp.revision)
      )
        throw new Error("Observation is no longer available.");
      if (store.principal !== (await principal())) throw new Error("Reader changed.");
      await store.acknowledge(observation, head.provider);
      deps.eventBus.emit("extension_events", "set", {
        id: crypto.randomUUID(),
        projectId,
        eventId: "pstdio.event.resource-seen-changed",
        resourceKeys: [resourceKey(head.resource)],
      });
      return (await store.query([head]))[0]!;
    },
  };
};
