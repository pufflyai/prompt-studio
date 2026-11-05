import { Box, HStack, IconButton, Stack, Tabs, Text } from "@chakra-ui/react";
import { DeleteConfirmationModal, ScrollArea } from "@pstdio/ui";
import { useState } from "react";
import { WorkbenchIcon } from "../shared/icon";
import { SettingsHeaderContent, useSettingsChanges } from "./settings-page-context";

const initialContent = "# Bug fix\n\nDescribe the issue, expected behavior and reproduction steps.\n";
// Synthetic asset controls share the production settings header and draft guard.
export const PreviewAsset = (props: { kind: "skill" | "template" }) => {
  const editable = props.kind === "template";
  const [deleting, setDeleting] = useState(false);
  useSettingsChanges(
    editable
      ? {
          dirty: false,
          onSave: () => {},
          onReset: () => {},
        }
      : undefined,
  );
  return (
    <Stack flex="1" minH="0" gap="0">
      <SettingsHeaderContent description={editable ? "A template for reporting and fixing bugs." : undefined}>
        {editable ? (
          <IconButton
            size="sm"
            variant="destructive-ghost"
            aria-label="Delete template"
            onClick={() => setDeleting(true)}
          >
            <WorkbenchIcon name="Trash2" size="1em" />
          </IconButton>
        ) : null}
      </SettingsHeaderContent>
      {editable ? (
        // Canvas's blob module loader cannot load Monaco worker URLs yet; the real template view uses CodeEditor.
        <ScrollArea flex="1" minH="0" contentProps={{ p: "md", bg: "codeEditor.background" }}>
          <Box as="pre" fontFamily="mono" m="0">
            {initialContent}
          </Box>
        </ScrollArea>
      ) : (
        <HStack flex="1" minH="0" gap="0" align="stretch" borderTopWidth="1px">
          <Tabs.Root
            defaultValue="info"
            size="sm"
            tray
            w="64"
            minH="0"
            flexShrink="0"
            borderRightWidth="1px"
            display="flex"
            flexDirection="column"
          >
            <Tabs.List flexShrink="0" py="sm">
              <Tabs.Trigger value="info">Info</Tabs.Trigger>
              <Tabs.Trigger value="files">Files</Tabs.Trigger>
            </Tabs.List>
            <Tabs.Content value="info" flex="1" minH="0" p="0">
              <ScrollArea h="full" minH="0" contentProps={{ p: "md" }}>
                <Stack gap="sm">
                  <Text>Name: create-ticket</Text>
                  <Text>Version: 1.2.0</Text>
                  <Stack gap="xs">
                    <Text>Description:</Text>
                    <Text color="fg.muted">
                      Create planner tickets from a short request, with a clear problem, expected behavior and
                      validation steps.
                    </Text>
                  </Stack>
                </Stack>
              </ScrollArea>
            </Tabs.Content>
            <Tabs.Content value="files" flex="1" minH="0" p="0">
              <ScrollArea h="full" minH="0" contentProps={{ p: "sm" }}>
                <Text>SKILL.md</Text>
              </ScrollArea>
            </Tabs.Content>
          </Tabs.Root>
          <ScrollArea flex="1" minW="0" contentProps={{ p: "lg" }}>
            <Stack gap="md">
              <Text textStyle="heading/S">Create ticket</Text>
              <Text>Create a ticket with a clear problem, expected behavior and validation steps.</Text>
            </Stack>
          </ScrollArea>
        </HStack>
      )}
      <DeleteConfirmationModal
        open={deleting}
        onClose={() => setDeleting(false)}
        onDelete={async () => setDeleting(false)}
        headline="Delete template"
        notificationText="Deletion is permanent. Reset changes cannot restore a deleted template. This preview uses synthetic data."
        buttonText="Delete template"
      />
    </Stack>
  );
};
