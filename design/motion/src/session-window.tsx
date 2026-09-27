import { Box, Flex, Stack, Text } from "@chakra-ui/react";
import { Header } from "@pstdio/ui";
import { FileText, MessageCircle, X } from "lucide-react";
import type { ReactNode } from "react";
import { SceneWindow } from "./scene-ui";

export const SessionWindow = (props: { children: ReactNode }) => {
  const { children } = props;
  return (
    <SceneWindow header={false}>
      <Flex h="full" minH="0">
        <Flex direction="column" flex="1" minW="0" overflow="hidden">
          <Header borderBottomWidth="1px" borderColor="border">
            <FileText size={14} />
            <Text textStyle="label/S/regular">README.md</Text>
            <X size={12} />
          </Header>
          <Stack p="lg" gap="md">
            <Text textStyle="heading/M">Motion studies</Text>
            <Text textStyle="paragraph/S/regular">Chat and workbench experiments for Prompt Studio.</Text>
            <Text textStyle="label/S/medium">Review checklist</Text>
            <Text textStyle="paragraph/S/regular" color="fg.muted">
              Readable messages. Stable controls. Clear activity while a turn is running.
            </Text>
            <Box borderTopWidth="1px" borderColor="border.subtle" />
            <Text textStyle="label/XS/regular" color="fg.muted">
              design/motion
            </Text>
          </Stack>
        </Flex>
        <Flex direction="column" w="420px" flexShrink="0" minH="0" borderLeftWidth="1px" borderColor="border">
          <Header borderBottomWidth="1px" borderColor="border">
            <MessageCircle size={14} />
            <Text textStyle="label/S/regular">Review motion studies</Text>
            <Box flex="1" />
            <X size={12} />
          </Header>
          <Box flex="1" minH="0" overflow="hidden">
            {children}
          </Box>
        </Flex>
      </Flex>
    </SceneWindow>
  );
};
