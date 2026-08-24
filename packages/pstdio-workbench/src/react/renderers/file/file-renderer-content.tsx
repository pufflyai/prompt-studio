import { Box, Center, Flex, Image, Text } from "@chakra-ui/react";
import { EmptyState } from "@pstdio/ui";
import { CodeEditor } from "@pstdio/ui/diff";
import { MarkdownEditor } from "@pstdio/ui/rich-text";
import type { ReactNode, RefObject } from "react";
import type { FileRendererContent } from "../../../core";
import { resolveFileRendererPresentation } from "./file-renderer-presentation";

interface FileRendererContentViewProps {
  content: FileRendererContent;
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
}

export const FileRendererContentView = (props: FileRendererContentViewProps) => {
  const {
    content,
    editorKey,
    errorNotice,
    contributionCanSave,
    onActiveSectionChange,
    onChange,
    rendererRef,
    sectionNavigation,
    title,
  } = props;
  const presentation = resolveFileRendererPresentation(content, contributionCanSave);

  if (presentation.kind === "empty") {
    return (
      <Flex direction="column" h="full" minH="0" bg="bg">
        {errorNotice}
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
        <Box flex="1" minH="0">
          <CodeEditor
            key={editorKey}
            language={presentation.language}
            defaultCode={content.content ?? ""}
            isEditable={presentation.isEditable}
            showLineNumbers
            onChange={presentation.isEditable ? onChange : undefined}
          />
        </Box>
      </Flex>
    );
  }

  return (
    <Flex ref={rendererRef} direction="column" h="full" minH="0" overflow="hidden" bg="bg">
      {errorNotice}
      <Box flex="1" minH="0" overflowY="auto">
        <MarkdownEditor
          key={editorKey}
          defaultState={content.content ?? ""}
          isEditable={presentation.isEditable}
          sectionNavigation={sectionNavigation}
          placeholder={presentation.isEditable ? (content.placeholder ?? "Write…") : undefined}
          onActiveSectionChange={onActiveSectionChange}
          onChange={presentation.isEditable ? onChange : undefined}
        />
      </Box>
    </Flex>
  );
};
