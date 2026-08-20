import { Box } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "storybook/test";
import { useWorkbenchThemePreferences, Workbench, WorkbenchThemeProvider } from "../../react";
import { createClosedCompositionPanelsWorkbench } from "./closed-composition-panels-workbench";

const meta = {
  title: "pstdio-workbench/Onboarding/Closed composition panels",
  parameters: { layout: "padded" },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

const workbench = createClosedCompositionPanelsWorkbench();

const ClosedPanelsFrame = () => {
  const themePreferences = useWorkbenchThemePreferences(workbench);
  return (
    <WorkbenchThemeProvider themePreferences={themePreferences}>
      <Box h="520px" minH="360px" borderWidth="1px" borderColor="border.subtle" overflow="hidden">
        <Workbench workbench={workbench} />
      </Box>
    </WorkbenchThemeProvider>
  );
};

export const AddPanelMenu: Story = {
  render: () => <ClosedPanelsFrame />,
  play: async ({ canvasElement }) => {
    await within(canvasElement).getByRole("button", { name: "Add panel" }).click();
    const body = within(canvasElement.ownerDocument.body);
    await expect(body.getByRole("menuitem", { name: "Artifacts" })).toBeVisible();
    await expect(body.getByRole("menuitem", { name: "Cams" })).toBeVisible();
  },
};
