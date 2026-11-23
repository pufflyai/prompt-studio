import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { TerminalSessionNotice } from "./terminal-session-notice";

const meta = {
  title: "Proposals/PS-289 Terminal session feedback",
  component: TerminalSessionNotice,
  render: (args) => (
    <div style={{ position: "relative", width: "min(720px, 90vw)", height: "320px", background: "#1e1e1e" }}>
      <TerminalSessionNotice {...args} color="#d4d4d4" />
    </div>
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
