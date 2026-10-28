import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
import { WorkbenchThemeProvider } from "../../react";
import { ResourceMenuSlotsExample } from "./module";
import source from "./module.tsx?raw";

const meta = {
  title: "pstdio-workbench/Guides/Resource menu slots",
  component: ResourceMenuSlotsExample,
  tags: ["!dev"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "A resource kind declares its public or owner-only menu slots. Commands target those typed slots, and the host maps them onto the resource header or context menu.",
      },
    },
  },
} satisfies CanvasMeta<typeof ResourceMenuSlotsExample>;
export default meta;
type Story = CanvasVariant<typeof meta>;
export const TwoResourceKinds: Story = {
  id: "pstdio-workbench-guides-resource-menu-slots--two-resource-kinds",
  parameters: {
    docs: { source: { code: source, language: "tsx", type: "code" } },
  },
  render: () => (
    <WorkbenchThemeProvider>
      <ResourceMenuSlotsExample />
    </WorkbenchThemeProvider>
  ),
};
