import { IconButton } from "@chakra-ui/react";
import { AlertMessage } from "@pstdio/ui";
import { Square, TriangleAlert } from "lucide-react";

export const SessionHarnessUnavailable = (props: { onInterrupt?: () => void }) => {
  const { onInterrupt } = props;
  return (
    <AlertMessage
      status="warning"
      role="alert"
      title="No agent available"
      icon={<TriangleAlert />}
      endElement={
        onInterrupt ? (
          <IconButton size="2xs" variant="ghost" aria-label="Stop session" onClick={onInterrupt}>
            <Square />
          </IconButton>
        ) : undefined
      }
    />
  );
};
