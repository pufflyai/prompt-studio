import { Box, Heading, Stack, Text } from "@chakra-ui/react";
import type { ReactNode } from "react";

interface TicketCardProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
}

export const TicketCard = (props: TicketCardProps) => {
  const { title, subtitle, children } = props;

  return (
    <Box bg="bg" borderWidth="1px" borderColor="border" borderRadius="md" p="lg" boxShadow="sm">
      <Stack gap="md">
        <Stack gap="xs">
          <Heading as="h2" textStyle="heading/XS/semibold">
            {title}
          </Heading>
          {subtitle ? (
            <Text textStyle="paragraph/S/regular" color="fg.muted">
              {subtitle}
            </Text>
          ) : null}
        </Stack>
        {children}
      </Stack>
    </Box>
  );
};
