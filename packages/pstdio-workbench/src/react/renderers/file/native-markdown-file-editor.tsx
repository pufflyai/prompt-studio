import { Flex } from "@chakra-ui/react";
import { LazyMarkdownEditor, type MarkdownEditorProps } from "@pstdio/ui/rich-text";
import { type ReactNode, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type {
  NativeDocumentSession,
  NativeDocumentSessionSnapshot,
} from "../../../core/native-documents/native-document-session";
import type { WorkbenchPresence } from "../../../core/presence/workbench-presence";
import { participantColor } from "../../shared/participant-color";
import { FileRendererErrorNotice } from "./file-renderer-error-notice";
import { FileRendererLoading } from "./file-renderer-loading";

interface NativeMarkdownFileEditorProps {
  connect: () => NativeDocumentSession;
  presence: WorkbenchPresence;
  open: boolean;
  placeholder?: string;
  sectionNavigation?: MarkdownEditorProps["sectionNavigation"];
  onActiveSectionChange?: MarkdownEditorProps["onActiveSectionChange"];
  errorNotice?: ReactNode;
}
const empty: NativeDocumentSessionSnapshot = { document: null, pending: false, connected: false, participants: [] };
const subscribeEmpty = () => () => {};
const getEmpty = () => empty;
const decode = (value: string) => Uint8Array.from(atob(value), (character) => character.charCodeAt(0));

export const NativeMarkdownFileEditor = (props: NativeMarkdownFileEditorProps) => {
  const { connect, presence, open, placeholder, sectionNavigation, onActiveSectionChange, errorNotice } = props;
  const connectRef = useRef(connect);
  connectRef.current = connect;
  const openRef = useRef(open);
  openRef.current = open;
  const [session, setSession] = useState<NativeDocumentSession | null>(null);
  const state = useSyncExternalStore(session?.subscribe ?? subscribeEmpty, session?.getSnapshot ?? getEmpty, getEmpty);
  useEffect(() => {
    const next = connectRef.current();
    next.setOpen(openRef.current);
    setSession(next);
    void next.start().catch(() => {});
    return () => {
      void next.close().catch(() => {});
    };
  }, []);
  useEffect(() => {
    if (!session) return;
    session.setOpen(open);
    if (!open) return;
    const registration = presence.register({
      getParticipants: () =>
        session.getSnapshot().participants.map((person) => ({ id: person.deviceId, label: person.label })),
      subscribe: session.subscribe,
    });
    return () => registration.dispose();
  }, [session, presence, open]);
  const participants = state.participants.map((participant) => {
    const id = `${participant.deviceId}:${participant.participantId}`;
    return {
      id,
      label: participant.label,
      color: participantColor(participant.deviceId),
      selection: participant.selection
        ? { anchor: decode(participant.selection.anchor), focus: decode(participant.selection.head) }
        : null,
    };
  });
  return (
    <Flex direction="column" h="full" minH="0" bg="bg">
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
    </Flex>
  );
};
