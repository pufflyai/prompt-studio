import { Box, Button, HStack, Stack } from "@chakra-ui/react";
import { Toaster } from "@pstdio/ui";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";
import { createWorkbench } from "../../core";
import { WorkbenchThemeProvider } from "../theme/workbench-theme-provider";
import { WorkbenchStatusBar } from "../workbench/workbench-panels";
import { WorkbenchActionErrors } from "./action-errors";
import { WorkbenchNotificationHost } from "./notification-host";

const ErrorFeedback = (props: { errorCount?: number; longMessages?: boolean }) => {
  const { errorCount = 0, longMessages = false } = props;
  const [workbench] = useState(() => {
    const workbench = createWorkbench();
    workbench.commands.registerCommand(
      { id: "restart-service", label: "Restart service" },
      {
        execute: () => {
          throw new Error("The service could not be restarted. Try again when the connection recovers.");
        },
      },
    );
    for (let index = 0; index < errorCount; index++) {
      workbench.notifications.show({
        id: `system-error-${index}`,
        level: "error",
        title: `System error ${index + 1}${longMessages ? `: ${"extension-process-".repeat(12)}` : ""}`,
        message: longMessages
          ? `Unable to load /${"long-unbroken-resource-name".repeat(30)}.\n${"The service is unavailable. ".repeat(8)}`
          : "The extension process stopped unexpectedly. Restart it to recover.",
        actions: longMessages
          ? [{ title: `Restart ${"unbroken-service-name".repeat(8)}`, commandId: "restart-service" }]
          : undefined,
      });
    }
    return workbench;
  });
  return (
    <WorkbenchThemeProvider>
      <Stack h={errorCount ? "100dvh" : "320px"} minW="0" gap="md" p="md">
        <Box flex="1">
          <HStack flexWrap="wrap">
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

export const TwelveSystemErrors: Story = {
  args: { errorCount: 12 },
  play: async ({ canvas, canvasElement }) => {
    await userEvent.click(canvas.getByRole("button", { name: /System errors \(12\)/ }));
    const body = within(canvasElement.ownerDocument.body);
    const list = await body.findByRole("region", { name: "System error list" });
    await expect(within(list).getAllByRole("button", { name: /^Dismiss / })).toHaveLength(12);
    await expect(list.scrollHeight).toBeGreaterThan(list.clientHeight);
    await expect(list.scrollWidth).toBeLessThanOrEqual(list.clientWidth);
  },
};

export const LongSystemErrors: Story = {
  args: { errorCount: 12, longMessages: true },
  play: TwelveSystemErrors.play,
};

export const HundredSystemErrors: Story = {
  args: { errorCount: 100 },
  play: async ({ canvas, canvasElement }) => {
    await userEvent.click(canvas.getByRole("button", { name: /System errors \(100\)/ }));
    const body = within(canvasElement.ownerDocument.body);
    const list = await body.findByRole("region", { name: "System error list" });
    await expect(within(list).getAllByRole("button", { name: /^Dismiss / })).toHaveLength(100);
    list.scrollTop = list.scrollHeight;
    await expect(within(list).getByText("System error 1", { exact: true })).toBeVisible();
  },
};
