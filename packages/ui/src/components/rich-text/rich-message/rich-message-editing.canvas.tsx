import { Box, Button, Stack } from "@chakra-ui/react";
import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
import { useState } from "react";
import { RichMessage } from "./rich-message";

const source =
  'Keep **source** spelling.\n\n[Notes][notes]\n\n[notes]: https://example.com "Title"\n\n~~~ts\nconst value = 1;\n~~~';
const meta: CanvasMeta<typeof RichMessage> = {
  title: "Patterns/Chat/Rich Message Editing",
  component: RichMessage,
};
export default meta;
type Story = CanvasVariant<typeof RichMessage>;
function EditingTransition() {
  const [editable, setEditable] = useState(false);
  const [value, setValue] = useState(source);
  return (
    <Stack>
      <Button onClick={() => setEditable((current) => !current)}>{editable ? "Finish editing" : "Edit message"}</Button>
      <RichMessage defaultState={source} isEditable={editable} onChange={setValue} />
      <Box as="pre" data-testid="emitted-markdown">
        {value}
      </Box>
    </Stack>
  );
}
export const EnableEditing: Story = {
  id: "patterns-chat-rich-message-editing--enable-editing",
  render: () => <EditingTransition />,
};
