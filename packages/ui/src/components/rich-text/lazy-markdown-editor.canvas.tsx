import { Button, HStack, Stack } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { useState } from "react";
import { LazyMarkdownEditor } from "./lazy-markdown-editor";
import { MarkdownEditorSkeleton } from "./markdown-editor-skeleton";

const meta: CanvasMeta<typeof LazyMarkdownEditor> = {
  title: "Design system/Patterns/Editors/Lazy Markdown editor",
  component: LazyMarkdownEditor,
  args: { defaultState: "# Ticket description\n\nThe editor loads when this view opens.", isEditable: true },
};
export default meta;
type Story = CanvasFrame<typeof LazyMarkdownEditor>;
const LoadingPreview = () => {
  const [fullWidth, setFullWidth] = useState(false);
  const [inset, setInset] = useState(true);
  return (
    <Stack gap="md" minW="0">
      <HStack>
        <Button onClick={() => setFullWidth(!fullWidth)}>Toggle full width</Button>
        <Button onClick={() => setInset(!inset)}>Toggle inset</Button>
      </HStack>
      <MarkdownEditorSkeleton fullWidth={fullWidth} padding={inset ? undefined : "0"} />
    </Stack>
  );
};
export const Default: Story = {
  id: "patterns-editors-lazy-markdown-editor--default",
};
export const Loading: Story = {
  id: "patterns-editors-lazy-markdown-editor--loading",
  description: "The loading column shares the editor's maximum width and inset, including full-width surfaces.",
  render: () => <LoadingPreview />,
};
