import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { WorkbenchThemeProvider } from "../../react";
import { ResourceMenuSlotsExample } from "./module";

const meta = {
  title: "pstdio-workbench/Guides/Resource menu slots",
  component: ResourceMenuSlotsExample,
  description:
    "A resource kind declares its public or owner-only menu slots. Commands target those typed slots, and the host maps them onto the resource header or context menu.",
  fullscreen: true,
} satisfies CanvasMeta<typeof ResourceMenuSlotsExample>;
export default meta;
type Story = CanvasFrame<typeof meta>;
export const TwoResourceKinds: Story = {
  id: "pstdio-workbench-guides-resource-menu-slots--two-resource-kinds",
  render: () => (
    <WorkbenchThemeProvider>
      <ResourceMenuSlotsExample />
    </WorkbenchThemeProvider>
  ),
};
