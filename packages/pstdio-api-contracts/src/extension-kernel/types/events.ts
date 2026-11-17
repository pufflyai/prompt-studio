import type { CommandDiagnostic } from "./commands";
import type { Struct } from "./json";

export interface EventRef<TPayload extends Struct = Struct> {
  readonly extensionId?: string;
  readonly kind: "event";
  readonly id: string;
  payload?: TPayload;
}

export interface EventDeliveryResult {
  delivered: number;
  diagnostics?: CommandDiagnostic[];
}

/** Payload of the host's `artifactChanged(mount)` event for a watched artifact mount. */
export interface ArtifactChangedPayload {
  projectId: string;
  /** Local mount id, the same key `ctx.artifacts.mount(key)` takes. */
  mount: string;
  /**
   * Changed files and folders relative to the mount root, sorted, without duplicates.
   * Empty means "unknown or too many": reload everything from the mount.
   */
  paths: string[];
}

export interface QueryChangeEnvelope {
  projectId?: string;
  extensionId?: string;
  /** Opaque structured-storage identities, distinct from public resource IDs. At most 128 per hint. */
  recordIds?: readonly string[];
  resourceKey?: string;
  resourceKeys?: readonly string[];
  resourceIds?: readonly string[];
  changedFields?: readonly string[];
  changes?: readonly { resourceId: string; changedFields: readonly string[]; membership?: boolean }[];
  /** List membership may change after inserts, deletes, moves or filter-field edits. */
  membership?: boolean;
}
