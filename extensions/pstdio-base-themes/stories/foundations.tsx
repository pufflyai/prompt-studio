import { Box, HStack, Stack, Text } from "@chakra-ui/react";
import { GallerySection } from "./gallery-section";

const surfaces = ["bg", "bg.panel", "bg.subtle", "bg.muted", "bg.hover", "bg.active", "bg.code"] as const;

export function Foundations() {
  return (
    <GallerySection title="Surfaces, text and borders">
      <Stack gap="2xs">
        {surfaces.map((token) => (
          <Box key={token} data-theme-surface={token} bg={token} p="sm" borderWidth="1px" borderColor="border">
            <HStack justify="space-between">
              <Text textStyle="label/S/medium">{token}</Text>
              <Text color="fg.muted" textStyle="label/S/regular">
                Muted text
              </Text>
            </HStack>
          </Box>
        ))}
      </Stack>
      <HStack gap="sm">
        {(["border", "border.subtle", "border.accent"] as const).map((token) => (
          <Box key={token} borderWidth="1px" borderColor={token} p="xs">
            <Text textStyle="label/XS">{token}</Text>
          </Box>
        ))}
      </HStack>
      <Text textStyle="heading/M">Heading</Text>
      <Text textStyle="paragraph/S/regular">
        Body text and{" "}
        <Text as="span" color="fg.muted">
          secondary text
        </Text>
        .
      </Text>
    </GallerySection>
  );
}
