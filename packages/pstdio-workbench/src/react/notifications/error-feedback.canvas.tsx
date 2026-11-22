import { Box, Button, HStack, Stack } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { useState } from "react";
import { createWorkbench } from "../../core";
import { WorkbenchThemeProvider } from "../theme/workbench-theme-provider";
import { Workbench } from "../workbench/workbench";
import { WorkbenchStatusBar } from "../workbench/workbench-panels";
import { WorkbenchActionErrors } from "./action-errors";

const ErrorFeedback = (props: {
  errorCount?: number;
  longMessages?: boolean;
  statusHidden?: boolean;
  showLocalFailure?: boolean;
}) => {
  const { errorCount = 0, longMessages = false, statusHidden = false, showLocalFailure = false } = props;
  const [workbench] = useState(() => {
    const workbench = createWorkbench();
    if (statusHidden) {
      workbench.modes.registerMode({ id: "hidden-status", chrome: { status: false }, activate: () => undefined });
      workbench.modes.setActiveMode("hidden-status");
    }
    for (const [id, title] of [
      ["first-tool", "First tool"],
      ["second-tool", "Second tool"],
    ] as const) {
      workbench.views.registerView({ id, title, body: { kind: "react", render: () => <span>{title}</span> } });
      workbench.statusBar.registerItem({ id, viewId: id, slot: "leading" });
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
    if (showLocalFailure)
      workbench.notifications.captureActionError(
        "Save",
        "example-view",
      )(new Error("Choose a writable folder and save again."));
    return workbench;
  });
  const controls = (
    <Box flex="1" position="relative">
      <HStack flexWrap="wrap">
        <Button
          size="sm"
          onClick={() =>
            workbench.notifications.captureActionError(
              "Save",
              "example-view",
            )(new Error("Choose a writable folder and save again."))
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
        <Button
          size="sm"
          onClick={() => workbench.notifications.show({ id: "update", level: "info", title: "Update ready" })}
        >
          Report system information
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
    </WorkbenchThemeProvider>
  );
};
const meta = {
  title: "Product/Workbench/Feedback/Error feedback",
  component: ErrorFeedback,
  description:
    "Local failures stay near their action without moving content. System activity appears only while notices exist. Move and align it like other status widgets, open its details, then dismiss the last notice to hide it.",
  fullscreen: true,
} satisfies CanvasMeta<typeof ErrorFeedback>;
export default meta;
type Story = CanvasFrame<typeof meta>;
export const SystemAndActionErrors: Story = {
  id: "pstdio-workbench-reference-core-api-error-feedback--system-and-action-errors",
};
export const TwelveSystemErrors: Story = {
  id: "pstdio-workbench-reference-core-api-error-feedback--twelve-system-errors",
  args: { errorCount: 12 },
};
export const RecoveryActions: Story = {
  id: "pstdio-workbench-reference-core-api-error-feedback--recovery-actions",
  args: { errorCount: 1, showLocalFailure: true },
};
export const LongSystemErrors: Story = {
  id: "pstdio-workbench-reference-core-api-error-feedback--long-system-errors",
  args: { errorCount: 12, longMessages: true },
};
export const HundredSystemErrors: Story = {
  id: "pstdio-workbench-reference-core-api-error-feedback--hundred-system-errors",
  args: { errorCount: 100 },
};
export const HiddenStatusBar: Story = {
  id: "pstdio-workbench-reference-core-api-error-feedback--hidden-status-bar",
  args: { statusHidden: true },
};
