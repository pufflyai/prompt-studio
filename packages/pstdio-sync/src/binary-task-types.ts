import type { DocumentBlob } from "./relay/document-blob-manifest";

export class InvalidBinaryTask extends Error {}

export type BinaryTask =
  | { kind: "checkpoint"; updates: Uint8Array[] }
  | { kind: "compare"; local: Uint8Array[]; remote: Uint8Array }
  | { kind: "receive"; local: Uint8Array[]; update: Uint8Array }
  | { kind: "stage"; base: Uint8Array; updates: Uint8Array[]; summary?: Uint8Array };

export interface BinaryTaskResult {
  /** Comparison results distinguish retained causal gaps from uploadable state. */
  complete?: boolean;
  state: Uint8Array;
  summary: Uint8Array;
  blobs: DocumentBlob[];
  update: Uint8Array | null;
  rejected: number[];
}
