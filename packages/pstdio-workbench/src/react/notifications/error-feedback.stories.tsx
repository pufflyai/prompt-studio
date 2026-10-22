import { Box, Button, HStack, Stack } from "@chakra-ui/react";
import { Toaster } from "@pstdio/ui";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";
import { createWorkbench } from "../../core";
import { WorkbenchThemeProvider } from "../theme/workbench-theme-provider";
import { Workbench } from "../workbench/workbench";
import { WorkbenchStatusBar } from "../workbench/workbench-panels";
import { WorkbenchActionErrors } from "./action-errors";
import { WorkbenchNotificationHost } from "./notification-host";

const ErrorFeedback = (props: { errorCount?: number; longMessages?: boolean; statusHidden?: boolean }) => {
  const { errorCount = 0, longMessages = false, statusHidden = false } = props;
  const [workbench] = useState(() => {
    const workbench = createWorkbench();
    if (statusHidden) {
      workbench.modes.registerMode({ id: "hidden-status", chrome: { status: false }, activate: () => undefined });
      workbench.modes.setActiveMode("hidden-status");
    }
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
          : [{ title: "Restart service", commandId: "restart-service" }],
      });
    }
    return workbench;
  });
  const controls = (
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
  );
  if (statusHidden) {
    return (
      <WorkbenchThemeProvider>
        <Box h="100dvh">
          <Workbench workbench={workbench} titleBar={controls} />
        </Box>
      </WorkbenchThemeProvider>
    );
  }
  return (
    <WorkbenchThemeProvider>
      <Stack h={errorCount ? "100dvh" : "320px"} minW="0" gap="md" p="md">
        {controls}
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
    await expect(canvas.queryByRole("button", { name: /^System errors:/ })).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "Report system error" }));
    await expect(canvas.getByRole("button", { name: "System errors: Extension stopped" })).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Recover system" }));
    await expect(canvas.queryByRole("button", { name: /^System errors:/ })).not.toBeInTheDocument();
    await expect(canvas.getByRole("alert")).toHaveTextContent("You do not have permission");
  },
};

export const TwelveSystemErrors: Story = {
  args: { errorCount: 12 },
  play: async ({ canvas, canvasElement }) => {
    await userEvent.click(canvas.getByRole("button", { name: /^System errors:/ }));
    const body = within(canvasElement.ownerDocument.body);
    const list = await body.findByRole("region", { name: "System error list" });
    await expect(within(list).getAllByRole("button", { name: /^Dismiss / })).toHaveLength(12);
    await expect(list.scrollHeight).toBeGreaterThan(list.clientHeight);
    await expect(list.scrollWidth).toBeLessThanOrEqual(list.clientWidth);
  },
};

export const RecoveryActions: Story = {
  args: { errorCount: 1 },
  play: async ({ canvas, canvasElement }) => {
    await userEvent.click(canvas.getByRole("button", { name: /^System errors:/ }));
    const body = within(canvasElement.ownerDocument.body);
    const list = await body.findByRole("region", { name: "System error list" });
    await userEvent.click(within(list).getByRole("button", { name: "Restart service" }));
    await expect(
      within(list).getByText("The service could not be restarted. Try again when the connection recovers."),
    ).toBeVisible();
    await expect(body.getByText("System errors (1)", { exact: true })).toBeVisible();
  },
};

export const LongSystemErrors: Story = {
  args: { errorCount: 12, longMessages: true },
  play: async (context) => {
    await TwelveSystemErrors.play?.(context);
    const body = within(context.canvasElement.ownerDocument.body);
    const list = body.getByRole("region", { name: "System error list" });
    await userEvent.click(within(list).getAllByRole("button", { name: /^Restart / })[0]);
    await expect(
      within(list).getByText("The service could not be restarted. Try again when the connection recovers."),
    ).toBeVisible();
    await expect(body.getByText("System errors (12)", { exact: true })).toBeVisible();
  },
};

export const HundredSystemErrors: Story = {
  args: { errorCount: 100 },
  play: async ({ canvas, canvasElement }) => {
    await userEvent.click(canvas.getByRole("button", { name: /^System errors:/ }));
    const body = within(canvasElement.ownerDocument.body);
    const list = await body.findByRole("region", { name: "System error list" });
    await expect(within(list).getAllByRole("button", { name: /^Dismiss / })).toHaveLength(100);
    list.scrollTop = list.scrollHeight;
    await expect(within(list).getByText("System error 1", { exact: true })).toBeVisible();
  },
};

export const HiddenStatusBar: Story = {
  args: { statusHidden: true },
  play: async ({ canvas, canvasElement }) => {
    const bar = canvasElement.querySelector<HTMLElement>('[data-workbench-region="status"]')!;
    await expect(bar).not.toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Save file" }));
    await expect(canvas.getByRole("alert")).toHaveTextContent("You do not have permission");
    await expect(bar).not.toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Report system error" }));
    await expect(bar).toBeVisible();
    await expect(canvas.getByRole("button", { name: "System errors: Extension stopped" })).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Recover system" }));
    await expect(bar).not.toBeVisible();
  },
};
