import { Box, Center, Flex, Image, Text } from "@chakra-ui/react";
import { CodeEditor } from "@pstdio/ui/diff";
import { MarkdownEditor } from "@pstdio/ui/rich-text";
import type { ReactNode, RefObject } from "react";
import type { FileRendererContent } from "../../../core";
import { codeLanguageFor, pickFileKind } from "./file-kind";

interface FileRendererContentViewProps {
  content: FileRendererContent;
  editorKey: string;
  errorNotice: ReactNode;
  isEditable: boolean;
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
    isEditable,
    onActiveSectionChange,
    onChange,
    rendererRef,
    sectionNavigation,
    title,
  } = props;
  const kind = pickFileKind(content.fileName, content.mimeType);

  if (kind === "image") {
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

  if (kind === "code") {
    return (
      <Flex direction="column" h="full" minH="0" bg="bg">
        {errorNotice}
        <Box flex="1" minH="0">
          <CodeEditor
            key={editorKey}
            language={codeLanguageFor(content.fileName)}
            defaultCode={content.content ?? ""}
            isEditable={isEditable}
            showLineNumbers
            onChange={isEditable ? onChange : undefined}
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
          isEditable={isEditable}
          sectionNavigation={sectionNavigation}
          placeholder={isEditable ? (content.placeholder ?? "Write…") : undefined}
          onActiveSectionChange={onActiveSectionChange}
          onChange={isEditable ? onChange : undefined}
        />
      </Box>
    </Flex>
  );
};
