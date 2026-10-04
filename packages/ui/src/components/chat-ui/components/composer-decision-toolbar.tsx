import { Button, Flex, HStack, Text } from "@chakra-ui/react";
import { useRef, useState } from "react";
import { COMPOSER_CONTROL_HEIGHT } from "./composer-constants";
import type { ComposerDecision } from "./composer-decision";

interface ComposerDecisionToolbarProps {
  decision: ComposerDecision;
  disabled: boolean;
}

export const ComposerDecisionToolbar = (props: ComposerDecisionToolbarProps) => {
  const { decision, disabled } = props;
  const [submitting, setSubmitting] = useState(false);
  const inFlight = useRef(false);
  const choose = async (actionId: string) => {
    const action = decision.actions.find((item) => item.id === actionId);
    if (inFlight.current || disabled || decision.pending || !action || action.disabled) return;
    inFlight.current = true;
    setSubmitting(true);
    try {
      await decision.onAction(actionId);
    } catch {
      // The host reports the error and retains this native decision for retry.
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  };
  return (
    <Flex aria-label="Plan decision" align="center" justify="space-between" gap="xs" wrap="wrap">
      {decision.controls}
      {decision.model ? (
        <Text textStyle="label/S/regular" minH={COMPOSER_CONTROL_HEIGHT} display="flex" alignItems="center">
          {decision.model}
        </Text>
      ) : null}
      <HStack gap="xs" marginStart="auto" wrap="wrap" justify="end">
        {decision.actions.map((action) => (
          <Button
            key={action.id}
            size="xs"
            variant={action.variant}
            disabled={disabled || submitting || decision.pending || action.disabled}
            onClick={() => void choose(action.id)}
          >
            {action.label}
          </Button>
        ))}
      </HStack>
    </Flex>
  );
};
