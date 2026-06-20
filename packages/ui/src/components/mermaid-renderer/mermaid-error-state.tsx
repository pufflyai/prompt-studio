import { Box, Text } from "@chakra-ui/react";
import { ScrollArea } from "@/components/scroll-area";

interface MermaidErrorStateProps {
  code: string;
  error: string;
}

export const MermaidErrorState = (props: MermaidErrorStateProps) => {
  const { code, error } = props;

  return (
    <Box role="alert" borderRadius="sm" bg="bg.panel" p="sm">
      <Text color="fg.error" textStyle="label/S/medium">
        Mermaid parse failed
      </Text>
      <Text color="fg.muted" textStyle="label/S/regular" mt="2xs" whiteSpace="pre-wrap">
        {error}
      </Text>
      <ScrollArea
        mt="sm"
        borderRadius="sm"
        bg="bg.muted"
        showHorizontalScrollbar
        showVerticalScrollbar={false}
        contentProps={{ p: "sm" }}
      >
        <Box as="pre" m="0" fontSize="sm">
          {code}
        </Box>
      </ScrollArea>
    </Box>
  );
};
