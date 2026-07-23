import { Box, Stack, Text } from "@chakra-ui/react";
import { ScrollArea } from "@pstdio/ui";
import { settingsFields } from "../mock-data/data";

export const SettingsPage = () => (
  <ScrollArea h="full" minH="0" contentProps={{ p: "2xl" }}>
    <Stack data-ps175-mode="settings" gap="xl" maxW="2xl" mx="auto" w="full">
      <Stack gap="xs">
        <Text textStyle="label/XS/regular" color="fg.muted" textTransform="uppercase" letterSpacing="0.08em">
          Settings mode
        </Text>
        <Text textStyle="heading/L" color="fg">
          Workspace preferences
        </Text>
        <Text textStyle="paragraph/M/regular" color="fg.muted">
          A focused layout that keeps the project-owned chrome stable and uses only the Main Panel.
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
