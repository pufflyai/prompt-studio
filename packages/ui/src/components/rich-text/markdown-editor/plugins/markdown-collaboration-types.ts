import type { TextEditingSession } from "@pstdio/sdk/extensions";
import type * as Y from "yjs";
import type { DocumentParticipant } from "../../../primitives/document-participants";

export interface MarkdownDocumentSelection {
  anchor: Uint8Array;
  focus: Uint8Array;
}
interface MarkdownCollaborationPresence {
  onSelectionChange?: (selection: MarkdownDocumentSelection | null) => void;
  participants?: readonly (DocumentParticipant & { selection: MarkdownDocumentSelection | null })[];
}
export type MarkdownCollaboration = MarkdownCollaborationPresence &
  (
    | { session: TextEditingSession; document?: never }
    | {
        /** @deprecated Use session for host-owned admission, durability and draft lifecycle. */ document: Y.Doc;
        session?: never;
      }
  );
