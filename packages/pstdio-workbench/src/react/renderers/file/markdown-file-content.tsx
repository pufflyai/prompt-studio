import { Box, Flex } from "@chakra-ui/react";
import { LazyMarkdownEditor } from "@pstdio/ui/rich-text";
import type { ReactNode } from "react";
import type { FileRendererContent } from "../../../core";
import type { FileRendererContentViewProps } from "./file-renderer-content";
import { NativeMarkdownFileEditor } from "./native-markdown-file-editor";
import { PublicMarkdownFileEditor } from "./public-markdown-file-editor";

interface MarkdownFileContentProps extends Omit<FileRendererContentViewProps, "content"> {
  content: FileRendererContent;
  editable: boolean;
  positionNotice: ReactNode;
}

export const MarkdownFileContent = (props: MarkdownFileContentProps) => {
  const {
    content,
    editable,
    positionNotice,
    rendererRef,
    editorKey,
    connectText,
    connectDocument,
    presence,
    open,
    sectionNavigation,
    onActiveSectionChange,
    errorNotice,
    onChange,
  } = props;
  if (connectText && content.textDocument) {
    return (
      <Flex ref={rendererRef} direction="column" h="full" minH="0" bg="bg">
        {positionNotice}
        <PublicMarkdownFileEditor
          key={editorKey}
          connect={connectText}
          presence={presence}
          open={open}
          placeholder={content.placeholder ?? "Write…"}
          sectionNavigation={sectionNavigation}
          onActiveSectionChange={onActiveSectionChange}
          errorNotice={errorNotice}
        />
      </Flex>
    );
  }
  if (editable && connectDocument && content.documentSource) {
    return (
      <Flex ref={rendererRef} direction="column" h="full" minH="0" bg="bg">
        {positionNotice}
        <NativeMarkdownFileEditor
          key={editorKey}
          connect={connectDocument}
          presence={presence}
          open={open}
          placeholder={content.placeholder ?? "Write…"}
          sectionNavigation={sectionNavigation}
          onActiveSectionChange={onActiveSectionChange}
          errorNotice={errorNotice}
        />
      </Flex>
    );
  }
  return (
    <Flex ref={rendererRef} direction="column" h="full" minH="0" overflow="hidden" bg="bg">
      {errorNotice}
      {positionNotice}
      <Box flex="1" minH="0" overflowY="auto">
        <LazyMarkdownEditor
          key={editorKey}
          defaultState={content.content ?? ""}
          isEditable={editable}
          sectionNavigation={sectionNavigation}
          placeholder={editable ? (content.placeholder ?? "Write…") : undefined}
          onActiveSectionChange={onActiveSectionChange}
          onChange={editable ? onChange : undefined}
        />
      </Box>
    </Flex>
  );
};
