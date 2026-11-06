import { Flex, Text } from "@chakra-ui/react";
import type { TextEditingSession } from "@pstdio/sdk/extensions";
import { LazyMarkdownEditor, type MarkdownEditorProps } from "@pstdio/ui/rich-text";
import { type ReactNode, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { NativeTextPresentation } from "../../../extensions/bridge/native-text-presentation";
import { createRetainedTextPresentation } from "../../../extensions/bridge/retained-text-presentation";
import { participantColor } from "../../shared/participant-color";
import { FileRendererErrorNotice } from "./file-renderer-error-notice";
import { FileRendererLoading } from "./file-renderer-loading";

interface PublicMarkdownFileEditorProps {
  connect: () => NativeTextPresentation;
  open: boolean;
  placeholder?: string;
  sectionNavigation?: MarkdownEditorProps["sectionNavigation"];
  onActiveSectionChange?: MarkdownEditorProps["onActiveSectionChange"];
  errorNotice?: ReactNode;
}
const subscribeEmpty = () => () => {};
const empty = () => undefined;

export const PublicMarkdownFileEditor = (props: PublicMarkdownFileEditorProps) => {
  const { connect, open, placeholder, sectionNavigation, onActiveSectionChange, errorNotice } = props;
  const connectRef = useRef(connect);
  connectRef.current = connect;
  const [session, setSession] = useState<TextEditingSession>();
  const [openingError, setOpeningError] = useState<string>();
  const retryRef = useRef<() => Promise<void>>(async () => {});
  const [presentation] = useState(() => createRetainedTextPresentation(() => connectRef.current()));
  const state = useSyncExternalStore(session?.subscribe ?? subscribeEmpty, session?.getSnapshot ?? empty, empty);
  useEffect(() => {
    // Retained views keep their document DOM while their public authority closes and reopens.
    setOpeningError(undefined);
    if (!open) return;
    let mounted = true;
    const receive = async (operation: () => Promise<TextEditingSession | undefined>) => {
      setOpeningError(undefined);
      try {
        const value = await operation();
        if (mounted && value) setSession(value);
      } catch (error) {
        if (mounted) setOpeningError(error instanceof Error ? error.message : String(error));
      }
    };
    retryRef.current = () => receive(presentation.retry);
    void receive(presentation.open);
    return () => {
      mounted = false;
      retryRef.current = async () => {};
      void presentation.close().catch(() => {});
    };
  }, [open, presentation]);
  const error = openingError ?? state?.error?.message;
  const participants =
    open && session && presentation.owns(session) && !state?.closing && !openingError
      ? state?.participants.map((person) => ({
          id: person.id,
          label: person.label,
          color: participantColor(person.id),
          selection: person.selection ? { anchor: person.selection.anchor, focus: person.selection.head } : null,
        }))
      : [];
  return (
    <Flex direction="column" h="full" minH="0" bg="bg">
      <Flex flex="1" minH="0">
        {session && state ? (
          <LazyMarkdownEditor
            collaboration={{
              session,
              participants,
              onSelectionChange: (selection) =>
                session.setSelection(selection ? { anchor: selection.anchor, head: selection.focus } : null),
            }}
            defaultState=""
            placeholder={placeholder}
            sectionNavigation={sectionNavigation}
            onActiveSectionChange={onActiveSectionChange}
            isEditable={open && presentation.owns(session) && state.editable && !state.closing}
          />
        ) : (
          !error && <FileRendererLoading />
        )}
      </Flex>
      {errorNotice}
      {error && (
        <FileRendererErrorNotice
          message={error}
          onRetry={() => {
            void retryRef.current();
          }}
        />
      )}
      {state && !state.editable && !error && (
        <Flex flex="none" layerStyle="documentNotice">
          <Text color="fg.muted" textStyle="label/S/regular">
            This document is read only.
          </Text>
        </Flex>
      )}
    </Flex>
  );
};
