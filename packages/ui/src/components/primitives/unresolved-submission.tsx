import { Button, HStack, Text } from "@chakra-ui/react";
import { useState } from "react";
import { AlertMessage } from "./alert";

interface SubmissionRecovery {
  copyDraft(): Promise<void>;
  dismiss(): void;
  discard(): void;
  isRetained(): boolean;
}

export class UnresolvedSubmissionError extends Error {
  constructor(
    readonly recovery: SubmissionRecovery,
    cause?: unknown,
  ) {
    super("Creation could not be confirmed.", { cause });
    this.name = "UnresolvedSubmissionError";
  }
}

interface UnresolvedSubmissionProps {
  submission: UnresolvedSubmissionError;
  onClose(): void;
  onInspect?(): void;
  onDiscard(): void;
}

export const UnresolvedSubmission = (props: UnresolvedSubmissionProps) => {
  const { submission, onClose, onInspect, onDiscard } = props;
  const [copyError, setCopyError] = useState(false);
  const dismiss = () => {
    submission.recovery.dismiss();
    onClose();
  };
  return (
    <AlertMessage status="warning" title={submission.message} compact>
      <Text>The draft is available. Inspect your resources before starting another submission.</Text>
      <HStack gap="xs" wrap="wrap">
        <Button size="xs" onClick={onInspect ?? onClose}>
          Inspect resources
        </Button>
        <Button size="xs" onClick={() => void submission.recovery.copyDraft().catch(() => setCopyError(true))}>
          Copy draft
        </Button>
        <Button size="xs" onClick={dismiss}>
          Dismiss
        </Button>
        <Button
          size="xs"
          variant="destructive"
          onClick={() => {
            submission.recovery.discard();
            onDiscard();
          }}
        >
          Discard draft
        </Button>
      </HStack>
      {copyError ? (
        <AlertMessage compact status="error" title="Could not copy the draft." onClose={() => setCopyError(false)} />
      ) : null}
    </AlertMessage>
  );
};
