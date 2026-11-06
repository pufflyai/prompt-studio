import { Box, Stack, Tabs, Text } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { LazyMarkdownEditor } from "@pstdio/ui/rich-text";

const documents = [
  { id: "ticket", title: "TEL-1 Ticket", label: "Ticket" },
  { id: "attachment", title: "scroll-proof.md", label: "Attachment" },
];
const RetainedMarkdown = () => (
  <Stack w="48rem" gap="sm">
    <Text textStyle="label/S/regular">Scroll each document, switch tabs, then return to the same place.</Text>
    <Tabs.Root
      defaultValue="ticket"
      lazyMount={false}
      unmountOnExit={false}
      display="flex"
      flexDirection="column"
      h="24rem"
    >
      <Tabs.List>
        {documents.map(({ id, title }) => (
          <Tabs.Trigger key={id} value={id}>
            {title}
          </Tabs.Trigger>
        ))}
      </Tabs.List>
      {documents.map(({ id, label }) => (
        <Tabs.Content key={id} value={id} p="0" flex="1" minH="0" overflow="hidden">
          <Box h="full" data-retained-document={id}>
            <LazyMarkdownEditor
              isEditable
              defaultState={Array.from({ length: 100 }, (_, index) => `${label} paragraph ${index + 1}`).join("\n\n")}
            />
          </Box>
        </Tabs.Content>
      ))}
    </Tabs.Root>
  </Stack>
);
export default {
  title: "Product/Workbench/File editor/Retained Markdown",
  component: RetainedMarkdown,
  description:
    "Synthetic ticket and attachment. Returning to a retained view preserves its document DOM and independent scroll position while public editing authority is reacquired. Existing editor and tab appearance is unchanged; no real project records are created.",
} satisfies CanvasMeta;
export const IndependentScroll: CanvasFrame = {};
