import type {
  PublishResourceActivity,
  ResourceActivityAttachment,
  ResourceActivityCapabilities,
  ResourceActivityEntry,
  ResourceActivityPage,
} from "../../resource-activity";
import type { ResourceRef } from "./resources";

export interface ResourceActivityApi {
  capabilities(resource: ResourceRef): Promise<ResourceActivityCapabilities | null>;
  query(input: { resource: ResourceRef; cursor?: string; limit?: number }): Promise<ResourceActivityPage>;
  get(resource: ResourceRef, id: string): Promise<ResourceActivityEntry>;
  publish(resource: ResourceRef, input: PublishResourceActivity): Promise<ResourceActivityEntry>;
  resolve(resource: ResourceRef, id: string, resolved: boolean): Promise<ResourceActivityEntry>;
  attach(
    resource: ResourceRef,
    input: { key?: string; name: string; mimeType: string; data: Uint8Array },
  ): Promise<ResourceActivityAttachment>;
  readAttachment(
    resource: ResourceRef,
    id: string,
  ): Promise<{ attachment: ResourceActivityAttachment; data: Uint8Array }>;
  /** Explicitly confirmed handoff. Retrying the same entry cannot create another session. */
  handoff(resource: ResourceRef, id: string, input?: { workspaceId?: string }): Promise<ResourceActivityEntry>;
}
