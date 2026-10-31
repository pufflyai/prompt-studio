import { Box, Center, Flex, Image, Text } from "@chakra-ui/react";
import type { FileSourcePosition } from "@pstdio/sdk/extensions";
import { AlertMessage, EmptyState } from "@pstdio/ui";
import { CodeEditor } from "@pstdio/ui/diff";
import { type ReactNode, type RefObject, Suspense, useLayoutEffect } from "react";
import type { FileRendererContent } from "../../../core";
import type { NativeDocumentSession } from "../../../core/native-documents/native-document-session";
import type { WorkbenchPresence } from "../../../core/presence/workbench-presence";
import type { NativeTextPresentation } from "../../../extensions/bridge/native-text-presentation";
import { FileRendererLoading } from "./file-renderer-loading";
import { resolveFileRendererPresentation } from "./file-renderer-presentation";
import { MarkdownFileContent } from "./markdown-file-content";

export interface FileRendererContentViewProps {
  content: FileRendererContent | null;
  presence: WorkbenchPresence;
  open: boolean;
  position?: FileSourcePosition;
  editorKey: string;
  errorNotice: ReactNode;
  contributionCanSave: boolean;
  onActiveSectionChange?: (sectionId: string | null) => void;
  onChange: (value: string) => void;
  rendererRef: RefObject<HTMLDivElement | null>;
  sectionNavigation?: {
    anchors: Array<{ id: string; heading: string; occurrence?: number }>;
    targetId: string;
  };
  title: string;
  connectDocument?: () => NativeDocumentSession;
  connectText?: () => NativeTextPresentation;
}

export const FileRendererContentView = (props: FileRendererContentViewProps) => {
  const {
    content,
    position,
    editorKey,
    errorNotice,
    contributionCanSave,
    onChange,
    rendererRef,
    sectionNavigation,
    title,
  } = props;
  useLayoutEffect(() => {
    if (!editorKey || sectionNavigation) return;
    const node = rendererRef.current;
    if (!node) return;
    const frame = requestAnimationFrame(() => {
      let current = node.parentElement;
      while (current) {
        const overflowY = getComputedStyle(current).overflowY;
        if (["auto", "scroll", "overlay"].includes(overflowY) && current.scrollHeight > current.clientHeight) {
          current.scrollTop = 0;
        }
        current = current.parentElement;
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [editorKey, sectionNavigation, rendererRef]);
  if (!content) return <FileRendererLoading />;
  const presentation = resolveFileRendererPresentation(content, contributionCanSave);
  const positionNotice =
    position && presentation.kind !== "code" && presentation.kind !== "empty" ? (
      <AlertMessage status="info" title="Source location unavailable">
        This preview does not support source line selection.
      </AlertMessage>
    ) : null;

  if (presentation.kind === "empty") {
    return (
      <Flex direction="column" h="full" minH="0" bg="bg">
        {errorNotice}
        {positionNotice}
        <EmptyState
          flex="1"
          minH="0"
          title={content.emptyState?.title ?? "Select a file"}
          description={content.emptyState?.description}
        />
      </Flex>
    );
  }

  if (presentation.kind === "image") {
    if (!content.dataUrl) {
      return (
        <Center h="full" minH="0" bg="bg" p="md">
          <Text color="fg.muted">This image preview is unavailable.</Text>
        </Center>
      );
    }
    return (
      <Flex direction="column" h="full" minH="0" bg="bg">
        {errorNotice}
        {positionNotice}
        <Center ref={rendererRef} flex="1" minH="0" p="md" overflow="auto">
          <Image src={content.dataUrl} alt={content.fileName ?? title} maxW="100%" maxH="100%" objectFit="contain" />
        </Center>
      </Flex>
    );
  }

  if (presentation.kind === "code") {
    return (
      <Flex direction="column" h="full" minH="0" bg="bg">
        {errorNotice}
        {positionNotice}
        <Box flex="1" minH="0">
          <Suspense fallback={<FileRendererLoading />}>
            <CodeEditor
              key={editorKey}
              language={presentation.language}
              position={position}
              fileName={content.fileName}
              defaultCode={content.content ?? ""}
              isEditable={presentation.isEditable}
              showLineNumbers
              onChange={presentation.isEditable ? onChange : undefined}
            />
          </Suspense>
        </Box>
      </Flex>
    );
  }

  return (
    <MarkdownFileContent
      {...props}
      content={content}
      editable={presentation.isEditable}
      positionNotice={positionNotice}
    />
  );
};
