import type { Json } from "./wire";

export interface StorageLogDefinition {
  name: string;
  /** Every device writes the project stream unless independent device streams are requested. */
  writer?: "project" | "device";
  keep?: { days: number };
}

/** Entries are immutable. Reuse an ID only for an identical append. */
export interface StorageLogEntry {
  id: string;
  writerId: string;
  createdAt: string;
  value: Json;
}

export interface StorageLogRead {
  after?: string | 0;
  limit?: number;
  /** Read only the newest page, then follow its returned cursor. */
  newest?: boolean;
}

export interface StorageLogPage {
  entries: StorageLogEntry[];
  /** Opaque seek position, including already displayed optimistic entries. */
  cursor: string;
  more: boolean;
}

export interface StorageLogApi {
  append(value: Json, options?: { id?: string }): Promise<StorageLogEntry>;
  read(options?: StorageLogRead): Promise<StorageLogPage>;
  follow(options?: { after?: string | 0; signal?: AbortSignal }): AsyncIterable<StorageLogEntry>;
}
