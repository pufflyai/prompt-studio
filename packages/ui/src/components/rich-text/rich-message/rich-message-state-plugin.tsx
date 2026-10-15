import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $addUpdateTag } from "lexical";
import { type RefObject, useEffect } from "react";
import { createMarkdownSourceDocument, type MarkdownSourceDocument } from "../shared/markdown-source-document";
import type { MarkdownUrlResolver } from "../shared/markdown-url";
import { importStreamingMarkdownToLexical } from "../shared/streaming-markdown";

export const SOURCE_IMPORT_TAG = "markdown-source-import";

export interface LoadedRichMessage {
  body: string;
  resolver?: MarkdownUrlResolver;
}

interface RichMessageStatePluginProps {
  body: string;
  resolver?: MarkdownUrlResolver;
  isEditable: boolean;
  streaming: boolean;
  loadedRef: RefObject<LoadedRichMessage>;
  sourceDocumentRef: RefObject<MarkdownSourceDocument | null>;
}

export function RichMessageStatePlugin(props: RichMessageStatePluginProps) {
  const { body, resolver, isEditable, streaming, loadedRef, sourceDocumentRef } = props;
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    const previous = loadedRef.current;
    const sourceUnchanged = previous.body === body && previous.resolver === resolver;
    if (sourceUnchanged && (!isEditable || sourceDocumentRef.current)) return;
    editor.update(
      () => {
        $addUpdateTag(SOURCE_IMPORT_TAG);
        if (isEditable) {
          const document = createMarkdownSourceDocument(body, resolver);
          sourceDocumentRef.current = document;
          document.importToLexical();
        } else {
          sourceDocumentRef.current = null;
          importStreamingMarkdownToLexical(body, resolver, streaming && body.startsWith(previous.body));
        }
        loadedRef.current = { body, resolver };
      },
      { tag: "history-merge" },
    );
  }, [body, resolver, isEditable, streaming, editor, loadedRef, sourceDocumentRef]);
  return null;
}
