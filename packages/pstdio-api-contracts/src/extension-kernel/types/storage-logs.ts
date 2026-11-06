import type {
  Json,
  StorageLogDefinition,
  StorageLogEntry,
  StorageLogPage,
  StorageLogRead,
} from "pstdio-sync-contracts";
import type { StorageScope } from "./storage";

export type {
  StorageLogDefinition,
  StorageLogEntry,
  StorageLogPage,
  StorageLogRead,
  StorageTextDeclaration,
} from "pstdio-sync-contracts";
export interface ExtensionStorageDeclaration {
  records?: { text?: readonly { prefix: string; fields: readonly string[] }[] };
  logs?: readonly (string | StorageLogDefinition)[];
}
export interface ExtensionLogApi {
  append(value: Json, options?: { id?: string }): Promise<StorageLogEntry>;
  read(options?: StorageLogRead): Promise<StorageLogPage>;
  /** Follow locally durable and newly downloaded entries. Cancellation releases the subscription. */
  follow(options?: { after?: string | 0; signal?: AbortSignal }): AsyncIterable<StorageLogEntry>;
}
export interface ExtensionLogOptions {
  scope?: StorageScope;
}
