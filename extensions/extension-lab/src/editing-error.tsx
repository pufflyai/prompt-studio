import { Button, HStack, Text } from "@chakra-ui/react";

interface EditingErrorProps {
  error: string;
  retry(): void | Promise<void>;
}
export const EditingError = (props: EditingErrorProps) => {
  const { error, retry } = props;
  return (
    <HStack gap="xs" px="sm" py="xs">
      <Text role="alert" color="fg.error" textStyle="label/XS" flex="1">
        {error}
      </Text>
      <Button variant="outline" size="xs" onClick={() => void retry()}>
        Retry
      </Button>
    </HStack>
  );
};
