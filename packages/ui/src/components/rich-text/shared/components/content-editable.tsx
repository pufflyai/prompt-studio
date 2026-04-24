import { Box, chakra } from "@chakra-ui/react";
import { ContentEditable as LexicalContentEditable } from "@lexical/react/LexicalContentEditable";
import { ScrollArea } from "@/components/scroll-area";

const StyledEditable = chakra(LexicalContentEditable);

interface ContentEditableProps {
  onRef?: (elem: HTMLDivElement) => void;
  fullWidth?: boolean;
  padding?: string;
  isRichMessage?: boolean;
  scrollable?: boolean;
}

export function ContentEditable({
  onRef,
  fullWidth = false,
  padding,
  isRichMessage = false,
  scrollable = true,
}: ContentEditableProps) {
  const editor = (
    <Box ref={onRef} width="100%" minH="100%" padding={padding}>
      <StyledEditable
        data-testid="content-editable"
        height="fit-content"
        minH="100%"
        width="100%"
        maxWidth={fullWidth ? "100%" : "720px"}
        marginInline={fullWidth ? "0" : "auto"}
        textStyle="paragraph/M/regular"
        fontSize="calc(var(--chakra-font-sizes-md) * var(--rich-text-font-scale))"
        position="relative"
        outline="none"
      />
    </Box>
  );

  if (!scrollable) return editor;

  return (
    <ScrollArea
      className="rich-text"
      data-rich-message={isRichMessage ? "true" : undefined}
      height="100%"
      minH="0"
      position="relative"
      contentProps={{ width: "100%", minH: "100%" }}
    >
      {editor}
    </ScrollArea>
  );
}
