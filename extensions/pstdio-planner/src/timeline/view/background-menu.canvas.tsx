import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { BackgroundMenu } from "./background-menu";

const meta: CanvasMeta<typeof BackgroundMenu> = {
  title: "Extensions/Planner/Timeline/Create Menu",
  component: BackgroundMenu,
};
export default meta;
type Story = CanvasFrame<typeof meta>;
export const TicketAndGate: Story = {
  id: "extensions-planner-timeline-create-menu--ticket-and-gate",
  args: { context: { x: 160, y: 160 }, onCreate: () => {}, onClose: () => {} },
};
export const AwayFromOrigin: Story = {
  id: "extensions-planner-timeline-create-menu--away-from-origin",
  args: { context: { x: 480, y: 320 }, onCreate: () => {}, onClose: () => {} },
};
