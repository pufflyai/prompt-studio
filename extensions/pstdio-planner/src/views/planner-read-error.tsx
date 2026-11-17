import { Button } from "@chakra-ui/react";
import { AlertMessage } from "@pstdio/ui";

interface PlannerReadErrorProps {
  error?: Error;
  retry(): void;
}

export const PlannerReadError = (props: PlannerReadErrorProps) => {
  const { error, retry } = props;
  if (!error) return null;
  return <AlertMessage status="error" title={error.message} endElement={<Button onClick={retry}>Retry</Button>} />;
};
