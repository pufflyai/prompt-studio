import { Flex } from "@chakra-ui/react";
import { DocumentHeader, DocumentSaveStatus, documentParticipantColors } from "@pstdio/ui";
import { LazyMarkdownEditor, type MarkdownEditorProps } from "@pstdio/ui/rich-text";
import { type ReactNode, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type {
  NativeDocumentSession,
  NativeDocumentSessionSnapshot,
} from "../../../core/native-documents/native-document-session";
import { FileRendererErrorNotice } from "./file-renderer-error-notice";
import { FileRendererLoading } from "./file-renderer-loading";

interface NativeMarkdownFileEditorProps {
  connect: () => NativeDocumentSession;
  title?: string;
  placeholder?: string;
  sectionNavigation?: MarkdownEditorProps["sectionNavigation"];
  onActiveSectionChange?: MarkdownEditorProps["onActiveSectionChange"];
  errorNotice?: ReactNode;
}
const empty: NativeDocumentSessionSnapshot = { document: null, pending: false, connected: false, participants: [] };
const subscribeEmpty = () => () => {};
const getEmpty = () => empty;
const decode = (value: string) => Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
const colorFor = (id: string) => {
  let hash = 0;
  for (const character of id) hash = (Math.imul(hash, 31) + character.charCodeAt(0)) >>> 0;
  return documentParticipantColors[hash % documentParticipantColors.length]!;
};

export const NativeMarkdownFileEditor = (props: NativeMarkdownFileEditorProps) => {
  const { connect, title = "Document", placeholder, sectionNavigation, onActiveSectionChange, errorNotice } = props;
  const connectRef = useRef(connect);
  connectRef.current = connect;
  const [session, setSession] = useState<NativeDocumentSession | null>(null);
  const state = useSyncExternalStore(session?.subscribe ?? subscribeEmpty, session?.getSnapshot ?? getEmpty, getEmpty);
  useEffect(() => {
    const next = connectRef.current();
    setSession(next);
    void next.start().catch(() => {});
    return () => {
      void next.close().catch(() => {});
    };
  }, []);
  const participants = state.participants.map((participant) => {
    const id = `${participant.deviceId}:${participant.participantId}`;
    return {
      id,
      label: participant.label,
      deviceName: participant.deviceName,
      color: colorFor(id),
      selection: participant.selection
        ? { anchor: decode(participant.selection.anchor), focus: decode(participant.selection.head) }
        : null,
    };
  });
  return (
    <Flex direction="column" h="full" minH="0" bg="bg">
      <DocumentHeader title={title} participants={participants} />
      {errorNotice}
      {state.error && (
        <FileRendererErrorNotice
          message={state.error}
          onRetry={() => {
            void session?.retry().catch(() => {});
          }}
        />
      )}
      {state.document ? (
        <Flex flex="1" minH="0">
          <LazyMarkdownEditor
            key={state.document.guid}
            collaboration={{
              document: state.document,
              participants,
              onSelectionChange: (selection) => {
                void session?.setSelection(selection).catch(() => {});
              },
            }}
            defaultState=""
            placeholder={placeholder}
            sectionNavigation={sectionNavigation}
            onActiveSectionChange={onActiveSectionChange}
            isEditable
          />
        </Flex>
      ) : (
        <FileRendererLoading />
      )}
      {state.document && <DocumentSaveStatus pending={state.pending} connected={state.connected} />}
    </Flex>
  );
};
