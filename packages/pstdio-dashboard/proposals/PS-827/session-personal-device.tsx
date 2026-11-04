import { AlertMessage } from "@pstdio/ui";
import { Monitor } from "lucide-react";

export const SessionPersonalDevice = (props: { name: string }) => {
  const { name } = props;
  return (
    <AlertMessage status="info" title={`${name} is offline`} icon={<Monitor />}>
      You can read this conversation. Reconnect {name} to continue it.
    </AlertMessage>
  );
};
