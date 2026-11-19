import { Box, Button, Flex, HStack, Stack, Text } from "@chakra-ui/react";
import { ExtensionIcon } from "../../components/extension-icon";
import { ExtensionIdentity } from "../../components/extension-identity";
import { ExtensionToggle } from "../../components/extension-toggle";
import type { ExtensionPreview } from "./extension-fixtures";
import { ExtensionLabel } from "./extension-labels";

interface ExtensionListRowProps {
  extension: ExtensionPreview;
  onOpen: () => void;
  onToggle: (enabled: boolean) => void;
}

// Proposal copy: retain the installed row's identity and toggle; separate visibility from scope.
export const ExtensionListRow = (props: ExtensionListRowProps) => {
  const { extension, onOpen, onToggle } = props;
  return (
    <Flex
      gap="md"
      paddingX="lg"
      paddingY="md"
      borderBottomWidth="1px"
      borderColor="border.subtle"
      align="center"
      wrap={{ base: "wrap", md: "nowrap" }}
      _hover={{ bg: "bg.subtle" }}
      data-testid="extension-preview-row"
      data-visibility={extension.visibility}
      data-scope={extension.scope}
    >
      <HStack gap="md" flex="1" minW={{ base: "full", md: "0" }}>
        <Flex
          align="center"
          justify="center"
          boxSize="9"
          flexShrink="0"
          borderWidth="1px"
          borderColor="border.subtle"
          borderRadius="xs"
          bg="bg.subtle"
          color={extension.enabled ? "fg" : "fg.subtle"}
        >
          <ExtensionIcon name={extension.icon} />
        </Flex>
        <Stack gap="2xs" flex="1" minW="0">
          <HStack gap="sm" minW="0">
            <Button variant="ghost" size="xs" p="0" h="auto" minW="0" onClick={onOpen}>
              <Text textStyle="label/S/medium" color={extension.enabled ? "fg" : "fg.muted"} truncate>
                {extension.displayName}
              </Text>
            </Button>
            <ExtensionIdentity value={`v${extension.version}`} />
          </HStack>
          <Text textStyle="label/XS" color="fg.muted" truncate>
            {extension.description}
          </Text>
        </Stack>
      </HStack>
      <HStack
        gap="md"
        flexShrink="0"
        w={{ base: "full", md: "auto" }}
        paddingStart={{ base: "12", md: "0" }}
        align="start"
      >
        <Box w="28" minH="10">
          <ExtensionLabel extension={extension} kind="visibility" showHint />
        </Box>
        <Box w="28" minH="10">
          <ExtensionLabel extension={extension} kind="scope" showHint />
        </Box>
        <Box w="16" display="flex" justifyContent="flex-end">
          <ExtensionToggle name={extension.displayName} enabled={extension.enabled} onToggle={onToggle} />
        </Box>
      </HStack>
    </Flex>
  );
};
