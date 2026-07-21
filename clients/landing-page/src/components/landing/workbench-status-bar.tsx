import { Box, HStack, Text } from "@chakra-ui/react";
import { StockholmIcon } from "@pstdio/ui";

export const WorkbenchStatusBar = () => {
  return (
    <HStack
      as="footer"
      aria-label="Workbench status"
      height="28px"
      flexShrink="0"
      gap="14px"
      px="12px"
      bg="bg.subtle"
      borderTopWidth="1px"
      borderColor="border"
      color="fg.muted"
    >
      <HStack gap="4px" fontFamily="mono" fontSize="9px">
        <Text>Made with</Text>
        <Text aria-label="love">❤️</Text>
        <Text>in</Text>
        <Box width="13px" height="13px" color="fg.muted">
          <StockholmIcon />
        </Box>
      </HStack>
      <Text flex="1" textAlign="right" fontFamily="body" fontSize="9px" color="fg.subtle">
        © {new Date().getFullYear()} Prompt Studio. All rights reserved.
      </Text>
    </HStack>
  );
};
