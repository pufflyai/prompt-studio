import { Box, HStack, Stack, Tabs, Text } from "@chakra-ui/react";
import { ScrollArea } from "@pstdio/ui";
import { useState } from "react";
import { WorkbenchIcon } from "../../../react";
import { settingsFields, settingsTabs, workbenchModes } from "../mock-data/data";

export const SettingsTabs = () => {
  const [active, setActive] = useState(settingsTabs[0].id);

  return (
    <HStack h="full" px="sm" gap="md">
      <HStack gap="xs">
        <WorkbenchIcon name={workbenchModes.settings.icon} size={16} />
        <Text textStyle="label/S/medium" color="fg">
          Settings
        </Text>
      </HStack>
      <Tabs.Root value={active} onValueChange={(event) => setActive(event.value)} variant="line" size="sm">
        <Tabs.List borderBottom="none">
          {settingsTabs.map((tab) => (
            <Tabs.Trigger key={tab.id} value={tab.id} gap="xs">
              <WorkbenchIcon name={tab.icon} size={14} />
              {tab.label}
            </Tabs.Trigger>
          ))}
        </Tabs.List>
      </Tabs.Root>
    </HStack>
  );
};

export const SettingsPage = () => (
  <ScrollArea h="full" minH="0" contentProps={{ p: "2xl" }}>
    <Stack gap="xl" maxW="2xl" mx="auto" w="full">
      <Stack gap="xs">
        <Text textStyle="label/XS/regular" color="fg.muted" textTransform="uppercase" letterSpacing="0.08em">
          Settings mode
        </Text>
        <Text textStyle="heading/L" color="fg">
          Workspace preferences
        </Text>
        <Text textStyle="paragraph/M/regular" color="fg.muted">
          A focus layout — no sidebars, no bottom panel — just a centered settings page with tabs above and a status bar
          below.
        </Text>
      </Stack>
      <Stack gap="md">
        {settingsFields.map((field) => (
          <Box key={field.id} borderWidth="1px" borderColor="border.subtle" borderRadius="md" p="md">
            <Stack gap="2xs">
              <Text textStyle="label/S/medium" color="fg">
                {field.label}
              </Text>
              <Text textStyle="paragraph/S/regular" color="fg.muted">
                {field.hint}
              </Text>
              <Box
                mt="xs"
                px="sm"
                py="xs"
                bg="bg.subtle"
                borderRadius="sm"
                borderWidth="1px"
                borderColor="border.subtle"
              >
                <Text textStyle="paragraph/S/medium" color="fg" fontFamily="mono">
                  {field.value}
                </Text>
              </Box>
            </Stack>
          </Box>
        ))}
      </Stack>
    </Stack>
  </ScrollArea>
);

export const SettingsStatus = () => (
  <HStack h="full" px="sm" gap="md">
    <HStack gap="xs">
      <WorkbenchIcon name="Save" size={12} color="fg.muted" />
      <Text textStyle="label/XS/medium" color="fg">
        All changes saved
      </Text>
    </HStack>
    <HStack gap="xs">
      <WorkbenchIcon name="Cloud" size={12} color="fg.muted" />
      <Text textStyle="label/XS/regular" color="fg.muted">
        Synced to workspace · 2s ago
      </Text>
    </HStack>
  </HStack>
);
