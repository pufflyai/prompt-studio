import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { TicketReviewPrototype } from "./ticket-review-prototype";

export default {
  title: "Proposals/PS-118 Resource activity",
  component: TicketReviewPrototype,
  fullscreen: true,
  description:
    "Canvas-only resource activity study using the shared Activity components. The ticket opts into comments and change history; the note opts into comments only; the document provides no activity state. Comments, replies, selected quotes, status/content changes and agent handoffs share the resource activity feed below its content. Use the resource menu to compare capabilities. No real records or sessions are created.",
} satisfies CanvasMeta<typeof TicketReviewPrototype>;

export const TicketReview: CanvasFrame<typeof TicketReviewPrototype> = {
  id: "proposals-ps-118--ticket-review",
  name: "Resource activity",
};
