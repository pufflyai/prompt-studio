import { Button, Flex, Text } from "@chakra-ui/react";

export const FileRendererErrorNotice = (props: { message: string; onRetry?: () => void }) => {
  const { message, onRetry } = props;
  return (
    <Flex
      flex="none"
      position="sticky"
      bottom="0"
      alignItems="center"
      justifyContent="space-between"
      gap="sm"
      borderTopWidth="1px"
      borderColor="border.muted"
      bg="bg.muted"
      px="sm"
      py="xs"
    >
      <Text color="fg.muted" textStyle="label/S/regular">
        {message}
      </Text>
      {onRetry ? (
        <Button size="2xs" variant="subtle" onClick={onRetry}>
          Retry
        </Button>
      ) : null}
    </Flex>
  );
};
