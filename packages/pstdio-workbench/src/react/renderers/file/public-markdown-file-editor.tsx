import { Flex, Text } from "@chakra-ui/react";
import { LazyMarkdownEditor, preloadMarkdownEditor } from "@pstdio/ui/lazy-markdown-editor";
import type { MarkdownEditorProps } from "@pstdio/ui/rich-text";
import { type ReactNode, useEffect, useSyncExternalStore } from "react";
import type { NativeTextPresentation } from "../../../extensions/bridge/native-text-presentation";
import { participantColor } from "../../shared/participant-color";
import { FileRendererErrorNotice } from "./file-renderer-error-notice";
import { FileRendererLoading } from "./file-renderer-loading";
import { usePublicTextPresentation } from "./use-public-text-presentation";

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
  const { session, openingError, presentation, retry } = usePublicTextPresentation(connect, open);
  const state = useSyncExternalStore(session?.subscribe ?? subscribeEmpty, session?.getSnapshot ?? empty, empty);
  useEffect(() => {
    if (open) void preloadMarkdownEditor().catch(() => {});
  }, [open]);
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
            void retry();
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
