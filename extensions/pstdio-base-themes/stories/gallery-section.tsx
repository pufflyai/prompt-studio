import { Stack, Text } from "@chakra-ui/react";
import type { ReactNode } from "react";

export function GallerySection(props: { title: string; children: ReactNode }) {
  const { title, children } = props;
  return (
    <Stack as="section" gap="sm" minW="0">
      <Text as="h2" textStyle="label/M/medium">
        {title}
      </Text>
      {children}
    </Stack>
  );
}
