import { Box, SimpleGrid, Stack, Text } from "@chakra-ui/react";
import type { ReactNode } from "react";

// The gallery renders many component families on one canvas so a theme/token
// change can be reviewed across the whole system at once (flip the Storybook
// theme toolbar to compare). These helpers give every section a consistent shell.

export interface GalleryFrameProps {
  kicker: string;
  title: string;
  summary: string;
  children: ReactNode;
}

export const GalleryFrame = (props: GalleryFrameProps) => {
  const { kicker, title, summary, children } = props;

  return (
    <Box maxWidth="1480px" marginInline="auto" padding="lg">
      <Stack gap="xs" maxWidth="3xl" marginBottom="lg">
        <Text textStyle="label/XS/medium" textTransform="uppercase" letterSpacing="wider" color="fg.accent">
          {kicker}
        </Text>
        <Text textStyle="heading/L/medium">{title}</Text>
        <Text textStyle="paragraph/M/regular" color="fg.muted">
          {summary}
        </Text>
      </Stack>
      <Stack gap="xl">{children}</Stack>
    </Box>
  );
};

export interface GallerySectionProps {
  title: string;
  description?: string;
  children: ReactNode;
}

export const GallerySection = (props: GallerySectionProps) => {
  const { title, description, children } = props;

  return (
    <Stack gap="md">
      <Stack gap="3xs">
        <Text textStyle="heading/S/medium">{title}</Text>
        {description ? (
          <Text textStyle="paragraph/S/regular" color="fg.muted">
            {description}
          </Text>
        ) : null}
      </Stack>
      <SimpleGrid gap="md" minChildWidth="280px">
        {children}
      </SimpleGrid>
    </Stack>
  );
};

export interface GalleryCardProps {
  title: string;
  names?: string[];
  children: ReactNode;
}

export const GalleryCard = (props: GalleryCardProps) => {
  const { title, names, children } = props;

  return (
    <Stack gap="sm" borderWidth="1px" borderColor="border.muted" borderRadius="md" background="bg.subtle" padding="md">
      <Stack gap="2xs">
        <Text textStyle="label/M/medium">{title}</Text>
        {names?.length ? (
          <Box display="flex" flexWrap="wrap" gap="2xs">
            {names.map((name) => (
              <Box
                key={name}
                as="code"
                textStyle="label/XS/regular"
                color="fg.muted"
                borderWidth="1px"
                borderColor="border.muted"
                borderRadius="sm"
                paddingInline="2xs"
              >
                {name}
              </Box>
            ))}
          </Box>
        ) : null}
      </Stack>
      <Stack gap="sm">{children}</Stack>
    </Stack>
  );
};
