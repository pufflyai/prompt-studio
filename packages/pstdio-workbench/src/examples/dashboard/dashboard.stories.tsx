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
          "A small dashboard-style workbench with sample workspaces, editable files, notes, conversations, and a sample terminal. Uses the real workbench navigation, panel movement, ownership, and persistence. The main showcase stays in its initial state for manual exploration.",
      },
    },
  },
} satisfies Meta<typeof DashboardDemo>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Dashboard: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole("tab", { name: "README.md" })).toBeVisible();
    await expect(await canvas.findByRole("tab", { name: "Review homepage" })).toBeVisible();
    await expect(await canvas.findByRole("textbox", { name: "Terminal command" })).toBeEnabled();
  },
};

export const InteractionChecks: Story = {
  tags: ["!dev"],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole("option", { name: "Design system" }));
    await expect(canvas.getByRole("textbox", { name: "Terminal command" })).toBeEnabled();
    await expect(canvas.getByRole("log", { name: "Terminal output" })).toHaveTextContent("/projects/design-system");
    await expect(canvas.getByRole("tab", { name: "Review homepage" })).toBeVisible();
    await userEvent.type(canvas.getByRole("textbox", { name: "Terminal command" }), "ls");
    await userEvent.click(canvas.getByRole("button", { name: "Run" }));
    await expect(canvas.getByRole("log", { name: "Terminal output" })).toHaveTextContent("package.json");
    await userEvent.click(canvas.getByRole("option", { name: "Website" }));
    await userEvent.click(canvas.getByRole("option", { name: "src/app.ts" }));
    await expect(await canvas.findByRole("tab", { name: "app.ts" })).toBeVisible();
    await userEvent.click(canvas.getByRole("option", { name: "README.md" }));
    await waitFor(() =>
      expect(canvas.getByRole("tab", { name: "README.md" })).toHaveAttribute("aria-selected", "true"),
    );
    await userEvent.click(canvas.getByRole("option", { name: "Launch checklist" }));
    await expect(await canvas.findByRole("tab", { name: "Launch checklist" })).toBeVisible();
    await userEvent.click(canvas.getByRole("option", { name: "Website" }));
    await expect(canvas.getByRole("tab", { name: "app.ts" })).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Reload layout" }));
    await expect(await canvas.findByRole("tab", { name: "app.ts" })).toBeVisible();
  },
};
