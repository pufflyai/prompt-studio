import { Heading, Stack, Text } from "@chakra-ui/react";
import type { ShellWidgetRenderInput } from "pstdio-shell/react";

// Placeholder global-settings surface. The legacy agents panel will land here in
// a follow-up pass; this scaffolds the shell wiring so commands and routes work.
export const SettingsWidget = (_props: { input: ShellWidgetRenderInput }) => {
  return (
    <Stack p="md" gap="sm" flex="1" minH="0" overflow="auto">
      <Heading size="md">Settings</Heading>
      <Text color="fg.muted" textStyle="label/M/regular">
        Global Prompt Studio settings will appear here.
      </Text>
    </Stack>
  );
};
