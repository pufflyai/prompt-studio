import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { TicketReviewPrototype } from "./ticket-review-prototype";

export default {
  title: "Proposals/PS-118 Inline ticket review",
  component: TicketReviewPrototype,
  fullscreen: true,
  description:
    "Canvas-only study with local sample data. Select text and use Add comment or Mod+Shift+M. Explore replies, resolve/reopen, removed text, @ agent selection, confirmation and session context. Planner opens board/list previews with the live open-comment count. Prototype controls expose handoff failures, raw Markdown and an empty panel. Reset restores the sample. No comments persist and no agent sessions start.",
} satisfies CanvasMeta<typeof TicketReviewPrototype>;

export const TicketReview: CanvasFrame<typeof TicketReviewPrototype> = {
  id: "proposals-ps-118--ticket-review",
  name: "Ticket review",
};
