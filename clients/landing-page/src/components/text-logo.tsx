import { Badge, Box, Flex, Text } from "@chakra-ui/react";
import { PromptStudioLogo } from "./prompt-studio-logo";

export const TextLogo = () => {
  return (
    <Flex cursor="pointer" alignItems="center" gap="0.625rem" flexShrink="0" height="3.5rem" minW="163px">
      <Box h="1.625rem" w="1.625rem">
        <PromptStudioLogo />
      </Box>
      <Flex alignItems="center" gap="0.5rem">
        <Text
          textStyle="brand"
          fontSize="1.375rem"
          lineHeight="2rem"
          letterSpacing="-0.04em"
          textAlign="left"
          color="foreground.primary"
        >
          Prompt Studio
        </Text>
        <Badge mt="-2rem" colorPalette="pink">
          alpha
        </Badge>
      </Flex>
    </Flex>
  );
};
