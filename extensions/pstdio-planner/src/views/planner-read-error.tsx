import { Button } from "@chakra-ui/react";
import { AlertMessage } from "@pstdio/ui";
import { useState } from "react";

interface PlannerReadErrorProps {
  error?: Error;
  retry(): void;
}

export const PlannerReadError = (props: PlannerReadErrorProps) => {
  const { error, retry } = props;
  const [dismissed, setDismissed] = useState<Error>();
  if (!error || error === dismissed) return null;
  return (
    <AlertMessage
      size="sm"
      status="error"
      title={error.message}
      position="absolute"
      bottom="xs"
      insetInlineStart="xs"
      zIndex="docked"
      onClose={() => setDismissed(error)}
      endElement={<Button onClick={retry}>Retry</Button>}
    />
  );
};
