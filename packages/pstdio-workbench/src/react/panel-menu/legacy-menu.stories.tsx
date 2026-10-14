import { Box, Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useEffect, useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { createWorkbench } from "../../core";
import { WorkbenchThemeProvider } from "../theme/workbench-theme-provider";
import { Workbench } from "../workbench/workbench";

const LegacyMenus = () => {
  const [workbench] = useState(() => {
    const core = createWorkbench({ defaultPanelOpenByRegionId: { sidenav: false, side: false, secondary: false } });
    core.views.registerView({
      id: "document",
      title: "Document",
      body: { kind: "react", render: () => <Text p="md">Legacy document</Text> },
    });
    core.views.registerView({
      id: "tools",
      title: "Tools",
      body: { kind: "react", render: () => <Text p="md">Legacy tools</Text> },
    });
    core.layout.registerPanel({
      id: "document",
      title: "Document",
      region: "main",
      rendererId: "document",
      panelMenus: [{ id: "tools", title: "Tools", side: "right", rendererId: "tools" }],
    });
    core.layout.openPanel("document", { role: "location" });
    core.panelMenuState.setOpen("panel-menu:tools", false);
    return core;
  });
  useEffect(
    () => () => {
      void workbench.dispose();
    },
    [workbench],
  );
  return (
    <WorkbenchThemeProvider>
      <Box data-testid="legacy-menu-frame" w="3xl" h="100dvh">
        <Workbench workbench={workbench} />
      </Box>
    </WorkbenchThemeProvider>
  );
};
const meta = {
  title: "pstdio-workbench/Reference/Core API/Panel menus",
  component: LegacyMenus,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof LegacyMenus>;
export default meta;
type Story = StoryObj<typeof meta>;
export const LegacyWithoutPage: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText("Legacy document")).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Editor panels" }));
    await userEvent.click(await within(document.body).findByRole("menuitemcheckbox", { name: "Tools" }));
    await waitFor(() => expect(canvas.getByText("Legacy tools")).toBeVisible());
    const frame = canvas.getByTestId("legacy-menu-frame");
    frame.style.width = "400px";
    await waitFor(() => expect(canvas.getByText("Legacy tools")).not.toBeVisible());
    await userEvent.click(canvas.getByRole("button", { name: "Editor panels" }));
    await userEvent.click(await within(document.body).findByRole("menuitemcheckbox", { name: "Tools" }));
    const floating = await within(document.body).findByRole("menu", { name: "Main right menu controls" });
    await waitFor(() => expect(floating).toBeVisible());
    frame.style.width = "900px";
    await waitFor(() =>
      expect(within(document.body).queryByRole("menu", { name: "Main right menu controls" })).toBeNull(),
    );
    await waitFor(() => expect(canvas.getByText("Legacy tools")).toBeVisible());
    frame.style.width = "400px";
    await waitFor(() => expect(canvas.getByText("Legacy tools")).not.toBeVisible());
    await expect(within(document.body).queryByRole("menu", { name: "Main right menu controls" })).toBeNull();
  },
};
