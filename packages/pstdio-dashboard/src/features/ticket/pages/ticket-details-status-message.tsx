import { Stack, Text } from "@chakra-ui/react";

export const TicketDetailsStatusMessage = (props: { message: string }) => {
  const { message } = props;

  return (
    <Stack gap="lg" height="100%" p="sm">
      <Text textStyle="paragraph/S/regular" color="foreground.secondary">
        {message}
      </Text>
    </Stack>
  );
};
