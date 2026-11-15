import type { ExtensionActivityApi, PublishResourceActivity, ResourceActivityEntry } from "../extensions";
import { resourceKey } from "../extensions";
/** A local Activity host for command tests. Real permissions and sync belong to API integration tests. */
export const createMemoryActivity = (): ExtensionActivityApi => {
  const entries = new Map<string, ResourceActivityEntry>();
  const keys = new Map<string, { id: string; input: string }>();
  const fileKeys = new Map<string, string>();
  const files = new Map<
    string,
    { resource: string; data: Uint8Array; attachment: ResourceActivityEntry["attachments"][number] }
  >();
  const get: ExtensionActivityApi["get"] = async (resource, id) => {
    const entry = entries.get(id);
    if (!entry || resourceKey(entry.resource) !== resourceKey(resource))
      throw new Error("Activity entry not found on this resource.");
    return structuredClone(entry);
  };
  const publish: ExtensionActivityApi["publish"] = async (resource, input: PublishResourceActivity) => {
    const key = JSON.stringify([resourceKey(resource), input.key]);
    const previous = keys.get(key);
    if (previous) {
      if (previous.input !== JSON.stringify(input)) throw new Error("Activity key was reused with changed content.");
      return get(resource, previous.id);
    }
    const id = crypto.randomUUID();
    const entry: ResourceActivityEntry = {
      ...input,
      id,
      resource: {
        ...resource,
        projectId: resource.projectId ?? "test-project",
        extensionId: resource.extensionId ?? "test-extension",
      },
      author: { type: "agent", id: input.revision?.sessionId ?? "test-agent", name: "Agent" },
      createdAt: new Date().toISOString(),
      resolved: false,
      attachments: (input.attachmentIds ?? []).map((id) => {
        const file = files.get(id);
        if (!file || file.resource !== resourceKey(resource)) throw new Error("Attachment not found");
        return file.attachment;
      }),
    };
    entries.set(id, structuredClone(entry));
    keys.set(key, { id, input: JSON.stringify(input) });
    return entry;
  };
  return {
    importEntry: async (resource, input) => {
      const entry = await publish(resource, input.entry);
      const next = {
        ...entry,
        author: input.author,
        createdAt: input.createdAt,
        origin: { resource: input.source, createdAt: input.createdAt },
      };
      entries.set(entry.id, next);
      return next;
    },
    record: async () => ({ id: crypto.randomUUID() }),
    capabilities: async () => ({ comments: true, changes: true, outcomes: true }),
    get,
    publish,
    query: async ({ resource, cursor, limit = 50 }) => {
      const all = [...entries.values()]
        .filter((entry) => resourceKey(entry.resource) === resourceKey(resource))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      const offset = Number(cursor ?? 0);
      return {
        items: all.slice(offset, offset + limit),
        nextCursor: offset + limit < all.length ? String(offset + limit) : null,
        unresolved: all.filter((entry) => entry.kind === "comment" && !entry.replyToId && !entry.resolved).length,
      };
    },
    resolve: async (resource, id, resolved) => {
      const entry = await get(resource, id);
      if (entry.kind !== "comment" || entry.replyToId) throw new Error("Only discussions can change state.");
      const next = { ...entry, resolved };
      entries.set(id, next);
      return next;
    },
    attach: async (resource, input) => {
      const digest = await crypto.subtle.digest("SHA-256", new Uint8Array(input.data));
      const sha256 = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
      const receipt = JSON.stringify([resourceKey(resource), input.key]);
      const identity = JSON.stringify([resourceKey(resource), input.name, input.mimeType, sha256]);
      const previous = input.key ? fileKeys.get(receipt) : undefined;
      if (previous) {
        const saved = files.get(previous)!;
        if (
          JSON.stringify([
            resourceKey(resource),
            saved.attachment.name,
            saved.attachment.mimeType,
            saved.attachment.sha256,
          ]) !== identity
        )
          throw new Error("Attachment key was reused with changed content.");
        return saved.attachment;
      }
      const id = crypto.randomUUID();
      const attachment = { id, name: input.name, mimeType: input.mimeType, size: input.data.byteLength, sha256 };
      files.set(id, { resource: resourceKey(resource), data: new Uint8Array(input.data), attachment });
      if (input.key) fileKeys.set(receipt, id);
      return attachment;
    },
    readAttachment: async (resource, id) => {
      const file = files.get(id);
      if (!file || file.resource !== resourceKey(resource)) throw new Error("Attachment not found");
      return { attachment: file.attachment, data: new Uint8Array(file.data) };
    },
    handoff: async () => {
      throw new Error("Session handoffs need a real host.");
    },
  };
};
