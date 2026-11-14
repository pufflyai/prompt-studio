import { Box, Dialog, Flex, Stack, Text } from "@chakra-ui/react";
import { FileIconThemePreferenceProvider, SettingsPage, TreeList } from "@pstdio/ui";
import { useState } from "react";
import { SkillViewerContent } from "../../components/skill-viewer";
import { InstalledExtensionSkill } from "../../components/skill-viewer.canvas";

export default { title: "Proposals/PS-235 Skills in navigation", fullscreen: true };

export const SkillsFooter = () => {
  const [open, setOpen] = useState(false);
  return (
    <FileIconThemePreferenceProvider>
      <Flex h="100vh" minH="0">
        <Flex direction="column" width="64" borderRightWidth="1px">
          <Box flex="1">
            {open && <TreeList sections={[{ id: "skills", label: "Skills", nodes: [{ id: "create-ticket", label: "Create Ticket", isNavigable: true }] }]} />}
          </Box>
          <TreeList sections={[{ id: "footer", nodes: [{ id: "skills", label: "Skills", isNavigable: true }, { id: "settings", label: "Settings" }] }]} onNavigate={() => setOpen(true)} />
        </Flex>
        <Box flex="1" minW="0">
          {open ? <SkillViewerContent skill={InstalledExtensionSkill.args!.skill!} /> : <Text p="md">Open Skills from the footer.</Text>}
        </Box>
      </Flex>
    </FileIconThemePreferenceProvider>
  );
};

export const NarrowSettings = () => (
  <Dialog.Root open size="xl" placement="center">
    <Dialog.Backdrop />
    <Dialog.Positioner>
      <Dialog.Content maxW="5xl" width="full" height="xl">
        <Dialog.Header><Dialog.Title>Settings</Dialog.Title></Dialog.Header>
        <Dialog.Body asChild>
          <Flex minH="0">
            <Stack width="56" flexShrink="0" borderRightWidth="1px" p="md">
              <Text>Workbench</Text><Text>Runtime</Text><Text>Appearance</Text><Text>Project folder</Text><Text>Templates</Text>
            </Stack>
            <SettingsPage title="Runtime"><Text p="md">Max concurrent sessions</Text></SettingsPage>
          </Flex>
        </Dialog.Body>
      </Dialog.Content>
    </Dialog.Positioner>
  </Dialog.Root>
);
