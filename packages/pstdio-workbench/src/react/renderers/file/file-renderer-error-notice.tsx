import { Button, Flex, Text } from "@chakra-ui/react";

export const FileRendererErrorNotice = (props: { message: string; onRetry?: () => void }) => {
  const { message, onRetry } = props;
  return (
    <Flex
      flex="none"
      layerStyle="documentNotice"
      alignItems="center"
      justifyContent="space-between"
      gap="sm"
      wrap="wrap"
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
