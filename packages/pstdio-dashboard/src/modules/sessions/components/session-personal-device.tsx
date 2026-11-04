import { Button } from "@chakra-ui/react";
import { AlertMessage } from "@pstdio/ui";
import { Monitor } from "lucide-react";

export const SessionPersonalDevice = (props: {
  name: string;
  connectionUnknown?: boolean;
  onReconnect?(): unknown;
}) => {
  const { name, connectionUnknown, onReconnect } = props;
  return (
    <AlertMessage
      status="info"
      title={connectionUnknown ? "Connection status unavailable" : `${name} is offline`}
      icon={<Monitor />}
      endElement={
        onReconnect ? (
          <Button size="xs" variant="outline" onClick={() => onReconnect()}>
            Check connection
          </Button>
        ) : undefined
      }
    >
      {connectionUnknown
        ? `Check the connection to ${name} before continuing this conversation.`
        : `You can read this conversation. Reconnect ${name} to continue it.`}
    </AlertMessage>
  );
};
