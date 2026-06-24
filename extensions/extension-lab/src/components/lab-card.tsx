import { Box, Heading, Stack, Text } from "@chakra-ui/react";
import type { ReactNode } from "react";

interface LabCardProps {
  title: string;
  subtitle: string;
  children: ReactNode;
}

export const LabCard = (props: LabCardProps) => {
  const { title, subtitle, children } = props;

  return (
    <Box bg="bg" borderWidth="1px" borderColor="border" borderRadius="md" p="lg">
      <Stack gap="md">
        <Stack gap="xs">
          <Heading as="h2" textStyle="heading/XS/semibold">
            {title}
          </Heading>
          <Text textStyle="paragraph/S/regular" color="fg.muted">
            {subtitle}
          </Text>
        </Stack>
        {children}
      </Stack>
    </Box>
  );
};
