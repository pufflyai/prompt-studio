import { Button } from "@chakra-ui/react";
import { AlertMessage } from "@pstdio/ui";

export const SessionQueueUnavailable = (props: { name: string; onRefresh(): unknown }) => {
  const { name, onRefresh } = props;
  return (
    <AlertMessage
      status="info"
      title={`Queue on ${name} is read-only`}
      endElement={
        <Button size="xs" variant="outline" onClick={() => onRefresh()}>
          Refresh queue
        </Button>
      }
    >
      Read the saved queue. Refresh it before sending or editing a message.
    </AlertMessage>
  );
};
