import type { QueryDependency } from "../query-change";
import type { JsonObject, JsonValue } from "./json";
import type { RendererEventReference } from "./renderer-base";
import type { WebviewCommandsExecuteParams } from "./webview-capabilities";

export type WebviewEditingCommand = Pick<WebviewCommandsExecuteParams, "commandId" | "params">;

/**
 * Required result of a command session's execute command and each source read.
 * `value` replaces the complete accepted object; `changes` patches that object.
 * Presentation sources can return patches without reading the document.
 * `sourceIds` names sources whose current freshness this response covers. When omitted,
 * a source read covers itself, an execute value covers all sources, and execute patches cover none.
 * Do not claim a source whose newer invalidation the result does not include.
 */
export type WebviewEditingCommandResult = (
  | { value: JsonObject; changes?: never }
  | { changes: WebviewEditingChange[]; value?: never }
) & { sourceIds?: string[] };

export interface WebviewEditingSource {
  id: string;
  /** Returns WebviewEditingCommandResult, not an arbitrary command value. */
  read: WebviewEditingCommand;
  dependsOn: RendererEventReference[];
  dependency?: QueryDependency;
}

/** The first authoritative read also supplies opaque storage dependencies. */
export interface WebviewEditingLoadResult {
  value: JsonObject;
  sources: WebviewEditingSource[];
}

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
  /** Present on command sessions, independent of already accepted commands. */
  hasDrafts?: boolean;
  pendingCommands?: number;
  error?: { message: string; channel?: "document" | "presentation"; sourceId?: string };
  /** Terminal authority retirement. Discard local optimism before notifying observers. */
  retired?: true;
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
  | {
      operation: "open-command";
      sessionId: string;
      key: string;
      /** Returns WebviewEditingLoadResult. All commands must belong to the caller. */
      read: WebviewEditingCommand;
      /** Receives params plus a stable operationId; returns WebviewEditingCommandResult. Retries must be idempotent. */
      command: WebviewEditingCommand;
      dependsOn: RendererEventReference[];
    }
  | {
      operation: "execute";
      sessionId: string;
      sequence: number;
      params: JsonObject;
      changes: WebviewEditingChange[];
      channel?: "document" | "presentation";
    }
  | { operation: "commit" | "preview"; sessionId: string; sequence: number; changes: WebviewEditingChange[] }
  | { operation: "cancel"; sessionId: string; sequence?: number }
  | { operation: "close" | "save"; sessionId: string }
  | { operation: "refresh"; sessionId: string; expectedVersion: number; value: JsonObject };

export interface WebviewEditingSessionEvent {
  sessionId: string;
  snapshot: WebviewEditingSnapshot;
  /** Present only for the caller whose local changes this event accepts. */
  appliedSequence?: number;
}
