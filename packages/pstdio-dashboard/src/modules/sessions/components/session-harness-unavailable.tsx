import { Button, HStack, IconButton } from "@chakra-ui/react";
import { AlertMessage } from "@pstdio/ui";
import { Square, TriangleAlert } from "lucide-react";

interface SessionHarnessUnavailableProps {
  onReviewExtensions: () => void;
  onInterrupt?: () => void;
}

export const SessionHarnessUnavailable = (props: SessionHarnessUnavailableProps) => {
  const { onReviewExtensions, onInterrupt } = props;
  return (
    <AlertMessage
      status="warning"
      role="alert"
      title="No agent available"
      icon={<TriangleAlert />}
      endElement={
        <HStack gap="2xs">
          <Button size="2xs" variant="outline" onClick={onReviewExtensions}>
            Browse extensions
          </Button>
          {onInterrupt ? (
            <IconButton size="2xs" variant="ghost" aria-label="Stop session" onClick={onInterrupt}>
              <Square />
            </IconButton>
          ) : null}
        </HStack>
      }
    />
  );
};
