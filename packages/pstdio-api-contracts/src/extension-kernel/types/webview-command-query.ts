import type { QueryDependency } from "../query-change";
import type { WebviewCommandsExecuteParams } from "./webview-capabilities";

/** A finite read command. Mutations and live streams do not belong in this owner. */
export interface WebviewCommandQueryDefinition {
  command: Omit<WebviewCommandsExecuteParams, "metadata">;
  dependsOn?: readonly string[];
  dependency?: QueryDependency;
}

export interface WebviewCommandQuerySnapshot {
  /** Monotonic source creation order within this host authority, including eviction/recreation. */
  generation: number;
  version: number;
  data?: unknown;
  error?: { message: string };
  stale: boolean;
  fetching: boolean;
  retired?: true;
}

export interface WebviewCommandQuerySeed {
  command: WebviewCommandQueryDefinition["command"];
  snapshot: WebviewCommandQuerySnapshot;
}

export type WebviewCommandQueryRequest =
  | ({ operation: "observe" | "read" | "refresh"; owner: string; requestId: string } & WebviewCommandQueryDefinition)
  | { operation: "close"; owner: string; requestId: string };

export interface WebviewCommandQueryEvent {
  requestId: string;
  snapshot: WebviewCommandQuerySnapshot;
}
