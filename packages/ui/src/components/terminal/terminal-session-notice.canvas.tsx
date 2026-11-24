import { Box } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { TerminalSessionNotice } from "./terminal-session-notice";

const meta = {
  title: "Design system/Components/Media/Terminal session feedback",
  component: TerminalSessionNotice,
  render: (args) => (
    <Box position="relative" width="full" maxWidth="2xl" height="xs" bg="bg.subtle">
      <TerminalSessionNotice {...args} />
    </Box>
  ),
} satisfies CanvasMeta<typeof TerminalSessionNotice>;
export default meta;

export const OpeningTerminal: CanvasFrame<typeof meta> = {
  id: "components-terminal--opening-terminal",
};
export const TerminalOpenUnconfirmed: CanvasFrame<typeof meta> = {
  id: "components-terminal--terminal-open-unconfirmed",
  args: { error: { message: "The terminal connection closed before the session opened." } },
};
