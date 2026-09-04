import type { Meta, StoryObj } from "@storybook/react";
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
} satisfies Meta<typeof ResourceMenuSlotsExample>;

export default meta;
type Story = StoryObj<typeof meta>;

export const TwoResourceKinds: Story = {
  parameters: {
    docs: { source: { code: source, language: "tsx", type: "code" } },
  },
  render: () => (
    <WorkbenchThemeProvider>
      <ResourceMenuSlotsExample />
    </WorkbenchThemeProvider>
  ),
};
