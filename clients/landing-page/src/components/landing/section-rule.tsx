import { Box, HStack, Text } from "@chakra-ui/react";

interface SectionRuleProps {
  label: string;
}

export const SectionRule = (props: SectionRuleProps) => {
  const { label } = props;

  return (
    <HStack gap="14px" width="100%">
      <Text
        fontFamily="mono"
        fontSize="11px"
        letterSpacing="1.8px"
        color="fg.subtle"
        whiteSpace="nowrap"
        transition="color 120ms ease"
        _groupHover={{ color: "fg" }}
      >
        {label}
      </Text>
      <Box flex="1" height="1px" bg="border" transition="background 120ms ease" _groupHover={{ bg: "fg.subtle" }} />
    </HStack>
  );
};
