import type {
  JsonObject,
  WebviewEditingChange,
  WebviewEditingSessionParams,
  WebviewEditingSnapshot,
} from "pstdio-api-contracts/extension-kernel";
import type { GuestHost } from "./guest-host";
import { createTextEditingClient } from "./text-editing-client";
import type { TextEditingClient } from "./text-editing-types";
import { openEditingSession } from "./webview-editing-session";

export type EditingSnapshot<State extends object> = Omit<WebviewEditingSnapshot, "value"> & { value: State };
export type EditingSessionOptions<State extends object> = Pick<
  Extract<WebviewEditingSessionParams, { operation: "open" }>,
  "key" | "save"
> & { initial: State };

export interface WebviewEditingSession<State extends object> {
  readonly id: string;
  getSnapshot(): EditingSnapshot<State>;
  subscribe(listener: () => void): () => void;
  /** Publish immediately; resolve when the shared save queue acknowledges this edit. */
  commit(changes?: WebviewEditingChange[]): Promise<void>;
  /** Add draft changes visible in all views without saving them. */
  preview(changes: WebviewEditingChange[]): Promise<void>;
  cancel(): Promise<void>;
  /** Retry or await the current save queue. */
  save(): Promise<void>;
  /** Re-read the backend when shared state changes while a read is in flight. */
  refresh(read: () => Promise<State>): Promise<void>;
  close(): Promise<void>;
}

export type EditingCommandSessionOptions = Omit<
  Extract<WebviewEditingSessionParams, { operation: "open-command" }>,
  "operation" | "sessionId"
>;
export interface EditingCommandOptions {
  changes?: WebviewEditingChange[];
  channel?: "document" | "presentation";
}
export interface WebviewCommandEditingSession<State extends object>
  extends Omit<WebviewEditingSession<State>, "commit" | "refresh"> {
  /** One completed gesture, one ordered domain command. Failed commands retain their operationId for save(). */
  execute(params: JsonObject, options?: EditingCommandOptions): Promise<void>;
}

export interface WebviewEditingClient {
  text: TextEditingClient;
  /** Share authoritative loading, previews and domain commands across views of one document. */
  openCommand<State extends object>(
    options: EditingCommandSessionOptions,
  ): Promise<WebviewCommandEditingSession<State>>;
  open<State extends object>(options: EditingSessionOptions<State>): Promise<WebviewEditingSession<State>>;
}

export const createWebviewEditingClient = (host: GuestHost) =>
  ({
    text: createTextEditingClient(host),
    open: <State extends object>(options: EditingSessionOptions<State>) =>
      openEditingSession<State>(host, { operation: "open", ...options, initial: options.initial as JsonObject }),
    openCommand: <State extends object>(options: EditingCommandSessionOptions) =>
      openEditingSession<State>(host, { operation: "open-command", ...options }),
  }) satisfies WebviewEditingClient;
