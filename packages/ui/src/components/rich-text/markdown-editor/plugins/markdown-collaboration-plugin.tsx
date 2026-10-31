import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { type RefObject, useEffect, useRef, useState } from "react";
import type { MarkdownDocumentBinding } from "../../shared/markdown-document-context";
import type { createMarkdownSessionDocument } from "../../shared/markdown-session-document";
import type { MarkdownSourceDocument } from "../../shared/markdown-source-document";
import { bindMarkdownCollaboration } from "./markdown-collaboration-binding";
import type { MarkdownCollaboration } from "./markdown-collaboration-types";
import { MarkdownCompositionRecovery } from "./markdown-composition-recovery";

export type { MarkdownCollaboration, MarkdownDocumentSelection } from "./markdown-collaboration-types";

interface CollaborationPluginProps {
  collaboration: MarkdownCollaboration;
  source: MarkdownSourceDocument;
  editable: boolean;
  onChange?: (source: string) => void;
  bindingRef: RefObject<MarkdownDocumentBinding | null>;
  onFinishingChange: (finishing: boolean) => void;
}
export const MarkdownCollaborationPlugin = (props: CollaborationPluginProps) => {
  const { collaboration, source, editable, onChange, bindingRef, onFinishingChange } = props;
  const [editor] = useLexicalComposerContext();
  const { document, session, onSelectionChange } = collaboration;
  const [recovery, setRecovery] = useState<ReturnType<typeof createMarkdownSessionDocument> | null>(null);
  const callbacks = useRef({ editable, onChange, onSelectionChange });
  callbacks.current = { editable, onChange, onSelectionChange };
  useEffect(
    () =>
      bindMarkdownCollaboration({
        editor,
        document,
        session,
        source,
        bindingRef,
        callbacks,
        onRecovery: (value) => {
          onFinishingChange(Boolean(value));
          setRecovery(value);
        },
      }),
    [document, session, source, editor, bindingRef, onFinishingChange],
  );
  return recovery ? <MarkdownCompositionRecovery binding={recovery} /> : null;
};
