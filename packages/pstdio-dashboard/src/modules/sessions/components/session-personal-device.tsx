import { Button } from "@chakra-ui/react";
import { AlertMessage } from "@pstdio/ui";
import { Monitor } from "lucide-react";

export const SessionPersonalDevice = (props: { name: string; onReconnect?(): unknown }) => {
  const { name, onReconnect } = props;
  return (
    <AlertMessage
      status="info"
      title={`${name} is offline`}
      icon={<Monitor />}
      endElement={
        onReconnect ? (
          <Button size="xs" variant="outline" onClick={() => onReconnect()}>
            Check connection
          </Button>
        ) : undefined
      }
    >
      You can read this conversation. Reconnect {name} to continue it.
    </AlertMessage>
  );
};
