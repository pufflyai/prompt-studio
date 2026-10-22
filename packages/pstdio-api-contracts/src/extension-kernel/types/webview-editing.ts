import type { JsonObject, JsonValue } from "./json";
import type { WebviewCommandsExecuteParams } from "./webview-capabilities";

/** One atomic set of fields. An empty path replaces the root object. */
export interface WebviewEditingChange {
  path: string[];
  value: JsonValue;
}

export interface WebviewEditingSnapshot {
  value: JsonObject;
  /** Changes for every preview, commit, cancellation, refresh, or acknowledgement. */
  version: number;
  /** Latest committed local edit. Preview changes do not increment this revision. */
  revision: number;
  /** Latest local revision acknowledged by the save command. */
  savedRevision: number;
}

export type WebviewEditingSessionParams =
  | {
      operation: "open";
      sessionId: string;
      key: string;
      initial: JsonObject;
      /** Receives `params` plus the coalesced `changes` array. Must belong to the caller. */
      save: Pick<WebviewCommandsExecuteParams, "commandId" | "params">;
    }
  | { operation: "commit" | "preview"; sessionId: string; sequence: number; changes: WebviewEditingChange[] }
  | { operation: "cancel" | "close" | "save"; sessionId: string }
  | { operation: "refresh"; sessionId: string; expectedVersion: number; value: JsonObject };

export interface WebviewEditingSessionEvent {
  sessionId: string;
  snapshot: WebviewEditingSnapshot;
  /** Present only for the caller whose local changes this event accepts. */
  appliedSequence?: number;
}
