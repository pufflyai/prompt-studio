import { Box, Button, Text } from "@chakra-ui/react";
import { Header } from "@pstdio/ui";
import type { Meta, StoryObj } from "@storybook/react";
import { useEffect, useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { Workbench, WorkbenchIcon, WorkbenchThemeProvider } from "../../react";
import { createDashboardFixture } from "./dashboard-fixture";

const DashboardDemo = () => {
  const [fixture] = useState(createDashboardFixture);
  const [generation, setGeneration] = useState(0);
  useEffect(
    () => () => {
      void fixture.dispose();
    },
    [fixture],
  );
  return (
    <WorkbenchThemeProvider>
      <Box h="100dvh" minH="0" minW="0" overflow="hidden">
        <Workbench
          key={generation}
          workbench={fixture.workbench}
          titleBar={
            <Header px="md" gap="sm">
              <WorkbenchIcon name="PanelsTopLeft" />
              <Text textStyle="paragraph/S/semibold">Prompt Studio</Text>
              <Text color="fg.muted" textStyle="paragraph/XS/regular">
                Interactive demo · sample data
              </Text>
              <Button
                ms="auto"
                variant="ghost"
                size="xs"
                onClick={async () => {
                  await fixture.reload();
                  setGeneration((value) => value + 1);
                }}
              >
                Reload layout
              </Button>
            </Header>
          }
        />
      </Box>
    </WorkbenchThemeProvider>
  );
};

const meta = {
  title: "pstdio-workbench/Showcases/Dashboard",
  component: DashboardDemo,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "A small dashboard-style workbench with sample workspaces, editable files, notes, conversations, and the dashboard terminal surface with independent sample sessions. Uses the real workbench navigation, panel movement, ownership, and persistence. The main showcase stays in its initial state for manual exploration.",
      },
    },
  },
} satisfies Meta<typeof DashboardDemo>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Dashboard: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole("tab", { name: "Files" })).toBeVisible();
    await expect(await canvas.findByRole("tab", { name: "Review homepage" })).toBeVisible();
    await expect(await canvas.findByRole("textbox", { name: "Terminal input" })).toBeEnabled();
  },
};

export const InteractionChecks: Story = {
  tags: ["!dev"],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const nav = within(canvas.getByRole("region", { name: "Sidenav" }));
    const secondary = within(canvasElement.querySelector('[data-workbench-panel="secondary"]') as HTMLElement);
    const side = within(canvasElement.querySelector('[data-workbench-panel="side"]') as HTMLElement);
    await expect(await secondary.findByRole("tab", { name: "Terminal 1" })).toBeVisible();
    await userEvent.click(secondary.getByRole("button", { name: "Add panel" }));
    await userEvent.click(await within(document.body).findByRole("menuitem", { name: "Terminal" }));
    await expect(await secondary.findByRole("tab", { name: "Terminal 2" })).toBeVisible();
    await expect(secondary.getByRole("tab", { name: "Terminal 1" })).toBeVisible();
    await userEvent.click(side.getByRole("button", { name: "Add panel" }));
    await userEvent.click(await within(document.body).findByRole("menuitem", { name: "Terminal" }));
    await expect(await side.findByRole("tab", { name: "Terminal 3" })).toBeVisible();
    await expect(canvas.getByRole("tab", { name: "Changes" })).toBeVisible();
    await userEvent.click(await nav.findByRole("option", { name: "Design system" }));
    await expect(await secondary.findByRole("tab", { name: "Terminal 4" })).toBeVisible();
    await expect(side.getByRole("tab", { name: "Terminal 3" })).toBeVisible();
    await userEvent.click(nav.getByRole("option", { name: "Website" }));
    await userEvent.click(canvas.getByRole("tab", { name: "Changes" }));
    await userEvent.click(nav.getByRole("option", { name: "src/app.ts" }));
    await expect(canvas.getByRole("tab", { name: "Files" })).toHaveAttribute("aria-selected", "true");
    await waitFor(() =>
      expect(
        within(canvas.getByRole("region", { name: "Main" }))
          .getAllByLabelText("File path src/app.ts")
          .find((element) => element.checkVisibility()),
      ).toBeVisible(),
    );
    await userEvent.click(nav.getByRole("option", { name: "README.md" }));
    await waitFor(() =>
      expect(
        within(canvas.getByRole("region", { name: "Main" }))
          .getAllByLabelText("File path README.md")
          .find((element) => element.checkVisibility()),
      ).toBeVisible(),
    );
    await userEvent.click(nav.getByRole("option", { name: "Launch checklist" }));
    await expect(await canvas.findByRole("tab", { name: "Launch checklist" })).toBeVisible();
    await userEvent.click(nav.getByRole("option", { name: "Website" }));
    await expect(canvas.getByRole("tab", { name: "Files" })).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Reload layout" }));
    await expect(await canvas.findByRole("tab", { name: "Files" })).toBeVisible();
    await expect(canvas.getByRole("tab", { name: "Terminal 1" })).toBeVisible();
    await expect(canvas.getByRole("tab", { name: "Terminal 2" })).toBeVisible();
    await expect(canvas.getByRole("tab", { name: "Terminal 3" })).toBeVisible();
    canvas.getByRole("tab", { name: "Files" }).focus();
    await userEvent.keyboard("{Shift>}{F10}{/Shift}");
    await userEvent.click(await within(document.body).findByRole("menuitem", { name: "Move to Side" }));
    await userEvent.click(canvas.getByRole("button", { name: "Hide Sidebar" }));
    await userEvent.click(
      within(canvas.getByRole("region", { name: "Sidenav" })).getByRole("option", { name: "package.json" }),
    );
    await waitFor(() =>
      expect(
        within(canvas.getByRole("region", { name: "Side Panel" }))
          .getAllByLabelText("File path package.json")
          .find((element) => element.checkVisibility()),
      ).toBeVisible(),
    );
  },
};
