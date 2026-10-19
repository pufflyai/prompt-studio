import { Box, Button, HStack, Stack } from "@chakra-ui/react";
import { Toaster } from "@pstdio/ui";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { expect, userEvent } from "storybook/test";
import { createWorkbench } from "../../core";
import { WorkbenchThemeProvider } from "../theme/workbench-theme-provider";
import { WorkbenchStatusBar } from "../workbench/workbench-panels";
import { WorkbenchActionErrors } from "./action-errors";
import { WorkbenchNotificationHost } from "./notification-host";

const ErrorFeedback = () => {
  const [workbench] = useState(() => createWorkbench());
  return (
    <WorkbenchThemeProvider>
      <Stack h="320px" gap="md" p="md">
        <Box flex="1">
          <HStack>
            <Button
              size="sm"
              onClick={() =>
                workbench.notifications.captureActionError(
                  "Save",
                  "example-view",
                )(new Error("You do not have permission to save this file."))
              }
            >
              Save file
            </Button>
            <Button
              size="sm"
              onClick={() =>
                workbench.notifications.show({
                  id: "extension-crash",
                  level: "error",
                  title: "Extension stopped",
                  message: "The extension process stopped unexpectedly.",
                })
              }
            >
              Report system error
            </Button>
            <Button size="sm" onClick={() => workbench.notifications.dismiss("extension-crash")}>
              Recover system
            </Button>
          </HStack>
          <WorkbenchActionErrors workbench={workbench} target="example-view" />
        </Box>
        <WorkbenchStatusBar workbench={workbench} />
      </Stack>
      <WorkbenchNotificationHost workbench={workbench} />
      <Toaster />
    </WorkbenchThemeProvider>
  );
};

const meta = {
  title: "pstdio-workbench/Reference/Core API/Error feedback",
  component: ErrorFeedback,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof ErrorFeedback>;
export default meta;
type Story = StoryObj<typeof meta>;

export const SystemAndActionErrors: Story = {
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Save file" }));
    await expect(canvas.getByRole("alert")).toHaveTextContent("You do not have permission");
    await expect(canvas.queryByRole("button", { name: /System errors \(/ })).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "Report system error" }));
    await expect(canvas.getByRole("button", { name: "System errors (1): Extension stopped" })).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Recover system" }));
    await expect(canvas.queryByRole("button", { name: /System errors \(/ })).not.toBeInTheDocument();
    await expect(canvas.getByRole("alert")).toHaveTextContent("You do not have permission");
  },
};
