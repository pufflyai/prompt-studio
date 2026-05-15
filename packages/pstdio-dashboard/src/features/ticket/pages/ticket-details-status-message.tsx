import { Stack, Text } from "@chakra-ui/react";

interface TicketDetailsStatusMessageProps {
  message: string;
}

export const TicketDetailsStatusMessage = (props: TicketDetailsStatusMessageProps) => {
  const { message } = props;

  return (
    <Stack gap="lg" height="100%" p="sm">
      <Text textStyle="paragraph/S/regular" color="foreground.secondary">
        {message}
      </Text>
    </Stack>
  );
};
