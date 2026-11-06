import type { TextEditingError, TextOpenInput, TextSourceGrant } from "pstdio-api-contracts/extension-kernel";
import type * as Y from "yjs";

export interface TextSelection {
  anchor: Uint8Array;
  head: Uint8Array;
}
export interface TextParticipant {
  id: string;
  label: string;
  deviceName: string;
  selection: TextSelection | null;
}
export interface TextEditingSnapshot {
  version: number;
  historyId: string;
  text: Y.Text;
  editable: boolean;
  closing: boolean;
  pending: boolean;
  connected: boolean;
  participants: TextParticipant[];
  error?: TextEditingError;
}
export interface TextEditingDraft {
  readonly text: Y.Text;
  commit(): Promise<void>;
  /** True only when tentative text was discarded. In-flight, uncertain and already acknowledged edits return false. */
  cancel(): boolean;
}
export interface TextEditingReceiveContext {
  /** Includes CRDT replacements and deletions, even when visible characters are equal. */
  readonly textChanged: boolean;
  readonly historyChanged: boolean;
  readonly editableChanged: boolean;
}
export interface TextEditingSession {
  readonly origin: object;
  getSnapshot(): TextEditingSnapshot;
  subscribe(listener: () => void): () => void;
  transact(change: (text: Y.Text) => void): void;
  createDraft(): TextEditingDraft;
  /** Every ingress invokes the handler. Proven unchanged receipts may keep buffered text; absent context requires a drain. */
  beforeReceive(handler: (context?: TextEditingReceiveContext) => void): () => void;
  beforeClose(handler: () => void | Promise<void>): () => void;
  flush(): Promise<void>;
  project(): Promise<void>;
  retry(): Promise<void>;
  setSelection(selection: TextSelection | null): void;
  close(): Promise<void>;
}
export interface TextEditingClient {
  current(): Promise<TextSourceGrant | undefined>;
  open(input: TextOpenInput): Promise<TextEditingSession>;
}
