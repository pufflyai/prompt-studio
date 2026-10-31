import { Button, Stack } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { useEffect, useState } from "react";
import { RichMessage } from "./rich-message";

// The text and eight-update workload follow workbench-fixture's long-stream-replay.ts.
const replayText = `Step 1. ${"I read the workspace files, compared them with the plan, and noted what changed. ".repeat(6)}`;
const StreamingMessage = () => {
  const [text, setText] = useState("Earlier text.");
  const [replay, setReplay] = useState(false);
  useEffect(() => {
    if (!replay) return;
    let chunk = 0;
    const timer = setInterval(() => {
      chunk += 1;
      setText(`Earlier text.\n\n${replayText.slice(0, Math.ceil((replayText.length * chunk) / 8))}`);
      if (chunk === 8) {
        clearInterval(timer);
        setReplay(false);
      }
    }, 25);
    return () => clearInterval(timer);
  }, [replay]);
  return (
    <Stack maxW="xl">
      <Button onClick={() => setText(`${text} New chunk.`)}>Append chunk</Button>
      <Button onClick={() => setReplay(true)}>Replay stream</Button>
      <RichMessage defaultState={text} streaming fullWidth />
    </Stack>
  );
};
const meta = {
  title: "Patterns/Editors/RichMessage/Streaming Motion",
  component: StreamingMessage,
} satisfies CanvasMeta<typeof StreamingMessage>;
export default meta;
type Story = CanvasFrame<typeof meta>;
export const ChunkFade: Story = {
  id: "patterns-editors-richmessage-streaming-motion--chunk-fade",
};
export const History: Story = {
  id: "patterns-editors-richmessage-streaming-motion--history",
  render: () => <RichMessage defaultState={replayText} fullWidth />,
};
