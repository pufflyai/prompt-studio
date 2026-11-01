import { Flex, Spinner, Text } from "@chakra-ui/react";
import type { TextEditingSession } from "@pstdio/sdk/extensions";
import { LazyMarkdownEditor, type MarkdownEditorProps } from "@pstdio/ui/rich-text";
import { type ReactNode, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { WorkbenchPresence } from "../../../core/presence/workbench-presence";
import type { NativeTextPresentation } from "../../../extensions/bridge/native-text-presentation";
import { participantColor } from "../../shared/participant-color";
import { FileRendererErrorNotice } from "./file-renderer-error-notice";
import { FileRendererLoading } from "./file-renderer-loading";

interface PublicMarkdownFileEditorProps {
  connect: () => NativeTextPresentation;
  presence: WorkbenchPresence;
  open: boolean;
  placeholder?: string;
  sectionNavigation?: MarkdownEditorProps["sectionNavigation"];
  onActiveSectionChange?: MarkdownEditorProps["onActiveSectionChange"];
  errorNotice?: ReactNode;
}
const subscribeEmpty = () => () => {};
const empty = () => undefined;

export const PublicMarkdownFileEditor = (props: PublicMarkdownFileEditorProps) => {
  const { connect, presence, open, placeholder, sectionNavigation, onActiveSectionChange, errorNotice } = props;
  const connectRef = useRef(connect);
  connectRef.current = connect;
  const [session, setSession] = useState<TextEditingSession>();
  const [openingError, setOpeningError] = useState<string>();
  const retryRef = useRef<() => Promise<void>>(async () => {});
  const state = useSyncExternalStore(session?.subscribe ?? subscribeEmpty, session?.getSnapshot ?? empty, empty);
  useEffect(() => {
    const presentation = connectRef.current();
    let mounted = true;
    retryRef.current = async () => {
      setOpeningError(undefined);
      try {
        const value = await presentation.retry();
        if (mounted) setSession(value);
      } catch (error) {
        if (mounted) setOpeningError(error instanceof Error ? error.message : String(error));
      }
    };
    void presentation.open().then(
      (value) => {
        if (mounted) setSession(value);
      },
      (error) => {
        if (mounted) setOpeningError(error instanceof Error ? error.message : String(error));
      },
    );
    return () => {
      mounted = false;
      retryRef.current = async () => {};
      // Ordinary close is drained by the placement owner before this render tree unmounts.
      void presentation.close().catch(() => {});
    };
  }, []);
  useEffect(() => {
    if (!session || !open) return;
    const registration = presence.register({
      getParticipants: () =>
        session.getSnapshot().participants.map((person) => ({ id: person.id, label: person.label })),
      subscribe: session.subscribe,
    });
    return () => registration.dispose();
  }, [session, open, presence]);
  const error = session ? state?.error?.message : openingError;
  const participants = state?.participants.map((person) => ({
    id: person.id,
    label: person.label,
    color: participantColor(person.id),
    selection: person.selection ? { anchor: person.selection.anchor, focus: person.selection.head } : null,
  }));
  return (
    <Flex direction="column" h="full" minH="0" bg="bg">
      {errorNotice}
      {error && (
        <FileRendererErrorNotice
          message={error}
          onRetry={() => {
            void retryRef.current();
          }}
        />
      )}
      {state?.pending && !error && (
        <Flex gap="xs" align="center" bg="bg.muted" px="sm" py="xs">
          <Spinner size="xs" color="fg.muted" aria-label={state.connected ? "Saving" : "Reconnecting"} />
          <Text color="fg.muted" textStyle="label/S/regular">
            {state.connected ? "Saving changes…" : "Changes are waiting to be saved."}
          </Text>
        </Flex>
      )}
      {state && !state.editable && !error && (
        <Flex bg="bg.muted" px="sm" py="xs">
          <Text color="fg.muted" textStyle="label/S/regular">
            This document is read only.
          </Text>
        </Flex>
      )}
      {session && state ? (
        <Flex flex="1" minH="0">
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
            isEditable={state.editable && !state.closing}
          />
        </Flex>
      ) : (
        !error && <FileRendererLoading />
      )}
    </Flex>
  );
};
