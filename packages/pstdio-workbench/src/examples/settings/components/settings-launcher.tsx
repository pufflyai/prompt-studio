import { Button, Center, Stack, Text } from "@chakra-ui/react";
import type { WorkbenchPanelRenderInput } from "../../../core";
import { WORKBENCH_SETTINGS_OPEN_COMMAND_ID, WorkbenchIcon } from "../../../react";

// The settings surface is a modal overlay; closing it leaves the main region empty.
// This landing widget gives the lesson a way back in by re-running the built-in
// open command — no need to know the overlay widget id.
export const SettingsLauncher = (props: { input: WorkbenchPanelRenderInput }) => {
  const { input } = props;

  return (
    <Center h="full" minH="0" p="lg">
      <Stack gap="md" align="center" maxW="420px" textAlign="center">
        <WorkbenchIcon name="Settings" size={28} />
        <Text textStyle="heading/M/semibold">Settings</Text>
        <Text textStyle="paragraph/S/regular" color="fg.muted">
          The settings surface opens as a modal overlay. Close it any time — reopen it from here.
        </Text>
        <Button onClick={() => void input.workbench.commands.executeCommand(WORKBENCH_SETTINGS_OPEN_COMMAND_ID)}>
          <WorkbenchIcon name="Settings" />
          Open settings
        </Button>
      </Stack>
    </Center>
  );
};
