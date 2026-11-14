import { Box, Flex, Stack, Text } from "@chakra-ui/react";
import { Header, ResizableSplitLayout, ScrollArea } from "@pstdio/ui";
import { InstalledExtensionSkill } from "../../src/skill-viewer.canvas";
import { SkillViewerContent } from "./skill-viewer";

export default { title: "Proposals/PS-235 Skill Browser", fullscreen: true };

export const Browser = () => (
  <Box h="100vh">
    <SkillViewerContent skill={InstalledExtensionSkill.args!.skill!} />
  </Box>
);
export const NarrowSettings = () => (
  <Flex h="100vh" align="center" justify="center" bg="bg">
    <Flex direction="column" w="94vw" maxW="760px" h="88vh" maxH="760px" layerStyle="panel" overflow="hidden">
      <Header>
        <Text>Settings</Text>
      </Header>
      <ResizableSplitLayout
        flex="1"
        minH="0"
        defaultSizePx={200}
        minSizePx={180}
        maxSizePx={280}
        contentMinSizePx={360}
        collapsible={false}
        separator="line"
        resizablePanel={
          <Stack p="sm" bg="bg.subtle" h="full">
            <Text>Runtime</Text>
            <Text>Appearance</Text>
            <Text>Keyboard shortcuts</Text>
            <Text>Project folder</Text>
          </Stack>
        }
        contentPanel={
          <ScrollArea h="full" contentProps={{ p: "md" }}>
            <Stack gap="md">
              <Text textStyle="label/L/medium">Runtime</Text>
              <Text>Maximum concurrent sessions</Text>
              <Text>Notifications</Text>
            </Stack>
          </ScrollArea>
        }
      />
    </Flex>
  </Flex>
);
