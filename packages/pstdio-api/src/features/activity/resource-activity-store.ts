import { createHash } from "node:crypto";
import type { AssetReference } from "pstdio-api-contracts";
import {
  type ActivityAuthor,
  historicalResourceActivitySchema,
  type PublishResourceActivity,
  publishResourceActivitySchema,
  type ResourceActivityEntry,
  resourceActivityEntrySchema,
} from "pstdio-api-contracts";
import { type ResourceRef, resourceKey } from "pstdio-api-contracts/extension-kernel";
import type { createExtensionStorageDBService } from "pstdio-db";
import type { AssetStore } from "pstdio-sync";
import { initialRecordRevision } from "pstdio-sync/records";
import { canonicalJson, type Json, type StorageRecordIndex } from "pstdio-sync-contracts";
import { activityEntryLinks } from "./resource-activity-links";

export const resourceActivityOwnerId = JSON.stringify(["pstdio", "resource-activity"]);
export const activityStorageOwner = (projectId: string) => ({
  workbenchId: projectId,
  extensionId: resourceActivityOwnerId,
});
const indexes: StorageRecordIndex[] = [
  {
    name: "activity",
    prefix: "entry/",
    equality: ["scope"],
    fields: {
      id: { path: ["id"], type: "string" },
      scope: { path: ["scope"], type: "string" },
      sourceOwner: { path: ["sourceOwner"], type: "string" },
      kind: { path: ["kind"], type: "string" },
      root: { path: ["root"], type: "boolean" },
      resolved: { path: ["resolved"], type: "boolean" },
      createdAt: { path: ["createdAt"], type: "string" },
    },
    orderBy: [
      { field: "createdAt", direction: "desc" },
      { field: "id", direction: "desc" },
    ],
  },
];
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Json;
export type ActivityStore = ReturnType<typeof createResourceActivityStore>;

/** Core-owned records use the same durable journals, indexed queries and Cloud sync as other shared resources. */
export const createResourceActivityStore = (
  service: ReturnType<typeof createExtensionStorageDBService>,
  projectId: string,
  content?: {
    assets: AssetStore;
    stage(id: string, body: string): Promise<AssetReference>;
    read(asset: AssetReference): Promise<string>;
  },
) => {
  const owner = activityStorageOwner(projectId);
  let opened: ReturnType<typeof service.open> | undefined;
  let ready: Promise<void> | undefined;
  const records = async () => {
    opened ??= service.open({ owner, assets: content?.assets });
    const store = (await opened).records;
    ready ??= store.defineIndexes(indexes);
    await ready;
    return store;
  };
  const identity = (resource: ResourceRef) => {
    if (resource.projectId !== projectId || !resource.extensionId)
      throw new Error("Activity requires the complete resource identity.");
    return resourceKey(resource);
  };
  const hydrate = async (record: { value: unknown; asset?: AssetReference | null }) => {
    const entry = resourceActivityEntrySchema.parse(record.value);
    if (record.asset) {
      if (!content) throw new Error("Activity content is unavailable.");
      return { ...entry, body: await content.read(record.asset) };
    }
    return entry;
  };
  const get = async (resource: ResourceRef, id: string) => {
    const scope = identity(resource);
    const record = await (await records()).read(`entry/${id}`);
    if (!record.exists || record.deleted) throw new Error("Activity entry not found on this resource.");
    const entry = resourceActivityEntrySchema.parse(record.value);
    if (resourceKey(entry.resource) !== scope) throw new Error("Activity entry belongs to another resource.");
    return hydrate(record);
  };
  const append = async (
    resource: ResourceRef,
    raw: PublishResourceActivity,
    author: ActivityAuthor,
    preserved?: { createdAt?: string; source?: ResourceRef; handoffDeviceId?: string },
  ) => {
    const input = (preserved?.source ? historicalResourceActivitySchema : publishResourceActivitySchema).parse(raw);
    const scope = identity(resource);
    const request = hash(
      canonicalJson(
        json({ input, author: { type: author.type, id: author.id, extensionId: author.extensionId }, preserved }),
      ),
    );
    const id = hash(JSON.stringify([scope, input.key, request]));
    const recordId = `entry/${id}`;
    const receiptId = `key/${hash(JSON.stringify([scope, input.key]))}`;
    const bodyAsset = input.body.length > 32000 ? await content?.stage(`body:${id}`, input.body) : undefined;
    if (input.body.length > 32000 && !bodyAsset) throw new Error("Activity body storage is unavailable.");
    const store = await records();
    const result = await store.transaction(async (locked) => {
      const receipt = await locked.read(receiptId);
      if (receipt.exists) {
        const previous = receipt.value as { request: string; id: string };
        if (previous.request !== request) throw new Error("Activity key was reused with changed content.");
        return locked.read(`entry/${previous.id}`);
      }
      const attachments = await activityEntryLinks(locked, resource, input, author);
      const { key: _key, attachmentIds: _ids, ...content } = input;
      const entry = resourceActivityEntrySchema.parse({
        ...content,
        id,
        resource,
        author,
        attachments,
        resolved: false,
        createdAt: preserved?.createdAt ?? new Date().toISOString(),
        handoffDeviceId: preserved?.handoffDeviceId,
        origin: preserved?.source ? { resource: preserved.source, createdAt: preserved.createdAt! } : undefined,
      });
      await locked.commit({
        operationId: crypto.randomUUID(),
        edits: [
          {
            recordId,
            expectedRevision: initialRecordRevision(),
            replace: json({
              ...entry,
              body: bodyAsset ? "" : entry.body,
              scope,
              root: !input.replyToId,
              sourceOwner: preserved?.source?.extensionId ?? "",
            }),
            asset: bodyAsset,
            deleted: false,
          },
          { recordId: receiptId, expectedRevision: initialRecordRevision(), replace: { id, request }, deleted: false },
        ],
      });
      return { value: entry };
    });
    return hydrate(result);
  };
  const unresolved = async (resource: ResourceRef) =>
    (
      await (
        await records()
      ).aggregate({
        index: "activity",
        where: {
          all: [
            { field: "scope", op: "eq", value: identity(resource) },
            { field: "kind", op: "eq", value: "comment" },
            { field: "root", op: "eq", value: true },
            { field: "resolved", op: "eq", value: false },
          ],
        },
      })
    ).count;
  const query = async (resource: ResourceRef, input: { cursor?: string; limit?: number }) => {
    const store = await records();
    const scope = identity(resource);
    const conditions: import("pstdio-sync-contracts").StoragePredicate[] = [{ field: "scope", op: "eq", value: scope }];
    if (input.cursor) {
      let after: { scope: string; createdAt: string; id: string };
      try {
        after = JSON.parse(Buffer.from(input.cursor, "base64url").toString());
      } catch {
        throw new Error("Invalid Activity cursor.");
      }
      if (after.scope !== scope || typeof after.createdAt !== "string" || typeof after.id !== "string")
        throw new Error("Activity cursor belongs to another resource.");
      conditions.push({
        any: [
          { field: "createdAt", op: "lt", value: after.createdAt },
          {
            all: [
              { field: "createdAt", op: "eq", value: after.createdAt },
              { field: "id", op: "lt", value: after.id },
            ],
          },
        ],
      });
    }
    const page = await store.query({ index: "activity", where: { all: conditions }, limit: input.limit ?? 50 });
    const last = page.records.at(-1);
    const nextCursor =
      page.cursor && last
        ? Buffer.from(JSON.stringify({ scope, createdAt: last.fields.createdAt, id: last.fields.id })).toString(
            "base64url",
          )
        : null;
    const rows = await store.readMany(page.records.map((item) => item.recordId));
    return {
      items: await Promise.all(rows.map(hydrate)),
      nextCursor,
      unresolved: await unresolved(resource),
    };
  };
  const update = async (
    resource: ResourceRef,
    id: string,
    change: (entry: ResourceActivityEntry) => ResourceActivityEntry,
  ) => {
    identity(resource);
    await (await records()).transaction(async (locked) => {
      const recordId = `entry/${id}`;
      const current = await locked.read(recordId);
      const entry = resourceActivityEntrySchema.parse(current.value);
      if (resourceKey(entry.resource) !== resourceKey(resource))
        throw new Error("Activity entry belongs to another resource.");
      if (entry.kind !== "comment" || entry.replyToId) throw new Error("Only a root discussion can change state.");
      const next = resourceActivityEntrySchema.parse(change(entry));
      await locked.commit({
        operationId: crypto.randomUUID(),
        edits: [
          { recordId, expectedRevision: current.revision, replace: json({ ...(current.value as object), ...next }) },
        ],
      });
    });
    return get(resource, id);
  };
  const hasImportedAttachment = async (resource: ResourceRef, id: string, sourceOwner: string) => {
    const store = await records();
    let cursor: string | undefined;
    do {
      const page = await store.query({
        index: "activity",
        where: {
          all: [
            { field: "scope", op: "eq", value: identity(resource) },
            { field: "sourceOwner", op: "eq", value: sourceOwner },
          ],
        },
        limit: 100,
        cursor,
      });
      for (const row of await store.readMany(page.records.map((record) => record.recordId))) {
        const entry = resourceActivityEntrySchema.parse(row.value);
        if (entry.origin?.resource.projectId === projectId && entry.attachments.some((file) => file.id === id))
          return true;
      }
      cursor = page.cursor ?? undefined;
    } while (cursor);
    return false;
  };
  return {
    hasImportedAttachment,
    owner,
    records,
    get,
    append,
    query,
    unresolved,
    update,
    resolve: (resource: ResourceRef, id: string, resolved: boolean) =>
      update(resource, id, (entry) => ({ ...entry, resolved })),
  };
};
