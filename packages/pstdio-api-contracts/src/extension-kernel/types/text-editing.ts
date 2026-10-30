import type { TextDocumentRef } from "./text-source";

export interface TextSourceGrant {
  token: string;
}
export type TextEditingErrorCode =
  | "capability_denied"
  | "grant_invalid"
  | "source_unavailable"
  | "source_read_only"
  | "source_retired"
  | "source_changed"
  | "missing_history"
  | "recovery_required"
  | "invalid_frame"
  | "projection_failed"
  | "session_closed"
  | "draft_active";
export interface TextEditingError {
  code: TextEditingErrorCode;
  message: string;
  retryable: boolean;
}
export interface TextWireSnapshot {
  state: string;
  seedId: string;
  sourceSeedId: string;
  sourceState?: string;
  revision: number;
  editable: boolean;
}
export interface TextWireParticipant {
  id: string;
  label: string;
  deviceName: string;
  selection: { anchor: string; head: string } | null;
}
export type TextOpenInput = TextDocumentRef | { grant: TextSourceGrant };
export type TextEditingRequest =
  | { operation: "current" }
  | { operation: "register" | "abandon"; memberId: string }
  | { operation: "open"; memberId: string; input: TextOpenInput; sourceState?: string; pendingUpdate?: string }
  | { operation: "submit"; handle: string; sequence: number; update: string }
  | { operation: "snapshot" | "close"; handle: string }
  | { operation: "project"; handle: string; revision: number }
  | { operation: "presence"; handle: string; selection: { anchor: string; head: string } | null }
  | { operation: "closeReady"; handle: string; barrierId: string }
  | { operation: "closeFailed"; handle: string; barrierId: string; error: TextEditingError };
export interface TextEditingOpened {
  handle: string;
  grant: TextSourceGrant;
  snapshot: TextWireSnapshot;
}
export type TextEditingResult<Request extends TextEditingRequest = TextEditingRequest> = Request extends {
  operation: "current";
}
  ? TextSourceGrant | undefined
  : Request extends { operation: "open" }
    ? TextEditingOpened
    : Request extends { operation: "submit" | "snapshot" }
      ? TextWireSnapshot
      : Request extends { operation: "project" }
        ? { revision: number }
        : void;
export type TextEditingEvent =
  | { type: "snapshot"; memberId: string; handle: string; version: number; snapshot: TextWireSnapshot }
  | { type: "presence"; memberId: string; handle: string; version: number; participants: TextWireParticipant[] }
  | { type: "error" | "retired"; barrierId?: string; memberId: string; handle: string; error: TextEditingError }
  | { type: "prepareClose"; barrierId: string };
