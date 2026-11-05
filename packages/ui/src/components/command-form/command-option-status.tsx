import { Button, HStack, Text } from "@chakra-ui/react";
import type { CommandOptionState } from "./command-option-resolver";

interface CommandOptionStatusProps {
  state?: CommandOptionState;
  onRetry: () => void;
}
export const CommandOptionStatus = (props: CommandOptionStatusProps) => {
  const { state, onRetry } = props;
  if (state?.status === "ready")
    return state.options.length === 0 ? (
      <Text px="sm" textStyle="paragraph/XS/regular" color="fg.muted">
        No options available.
      </Text>
    ) : null;
  return (
    <HStack px="sm" py="xs" gap="sm">
      <Text role="status" textStyle="paragraph/XS/regular" color={state?.status === "error" ? "fg.error" : "fg.muted"}>
        {state?.error ?? "Loading options…"}
      </Text>
      {state?.status === "error" ? (
        <Button size="xs" variant="outline" onClick={onRetry}>
          Retry
        </Button>
      ) : null}
    </HStack>
  );
};
