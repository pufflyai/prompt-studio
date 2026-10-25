import { Box } from "@chakra-ui/react";
import { workbenchPages } from "@pstdio/sdk/extensions";
import { createWorkbench } from "@pstdio/workbench";
import { Workbench } from "@pstdio/workbench/react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, within } from "storybook/test";
import { createStartModule } from "./module";

const StartPageLayout = () => {
  const [workbench] = useState(() => {
    const next = createWorkbench();
    next.modes.registerMode({ id: "project", activate() {} });
    next.registerModule(createStartModule());
    next.pageLocations.setProject("storybook-start-page");
    next.pageLocations.navigate({ kind: "page", page: workbenchPages.start });
    return next;
  });
  return (
    <Box h="100dvh">
      <Workbench workbench={workbench} />
    </Box>
  );
};

const meta = {
  title: "Start/Page layout",
  component: StartPageLayout,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof StartPageLayout>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByTestId("start-page")).toBeVisible();
    await expect(canvas.queryByLabelText("Main panel header")).not.toBeInTheDocument();
    await expect(canvas.queryByRole("tab", { name: "Start" })).toBeNull();
  },
};
