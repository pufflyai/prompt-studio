import { Badge, Box, HStack, Stack, Text, Textarea } from "@chakra-ui/react";
import { ScrollArea } from "@pstdio/ui";
import { useState } from "react";
import type { DemoSnippet } from "../demo-settings";

// A local demo editor for a single collection item — supplied by the contributor,
// never the framework. Stands in for a real per-item editor.
export const SnippetEditor = (props: { snippet: DemoSnippet }) => {
  const { snippet } = props;
  const [body, setBody] = useState(snippet.body);

  return (
    <ScrollArea h="full" minH="0" contentProps={{ p: "lg", display: "flex", flexDirection: "column", gap: "md" }}>
      <Stack gap="xs">
        <HStack gap="sm">
          <Text textStyle="heading/M/semibold">{snippet.name}</Text>
          <Badge colorPalette="purple">{snippet.category}</Badge>
        </HStack>
        <Text textStyle="paragraph/S/regular" color="fg.muted">
          A contributor-owned editor for one collection item — the framework only routed the selection here.
        </Text>
      </Stack>
      <Box maxW="640px">
        <Textarea value={body} onChange={(event) => setBody(event.target.value)} rows={6} />
      </Box>
    </ScrollArea>
  );
};
