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
  cancel(): void;
}
export interface TextEditingSession {
  readonly origin: object;
  getSnapshot(): TextEditingSnapshot;
  subscribe(listener: () => void): () => void;
  transact(change: (text: Y.Text) => void): void;
  createDraft(): TextEditingDraft;
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
