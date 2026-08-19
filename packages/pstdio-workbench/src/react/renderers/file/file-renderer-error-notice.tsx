import { Button, Flex, Text } from "@chakra-ui/react";

export const FileRendererErrorNotice = (props: { message: string; onRetry: () => void }) => {
  const { message, onRetry } = props;
  return (
    <Flex
      flex="none"
      alignItems="center"
      justifyContent="space-between"
      gap="sm"
      borderBottomWidth="1px"
      borderColor="border.muted"
      bg="bg.muted"
      px="sm"
      py="xs"
    >
      <Text color="fg.muted" textStyle="label/S/regular">
        {message}
      </Text>
      <Button size="2xs" variant="subtle" onClick={onRetry}>
        Retry
      </Button>
    </Flex>
  );
};
