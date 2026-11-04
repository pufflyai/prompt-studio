import { AlertMessage } from "@pstdio/ui";
import { Monitor } from "lucide-react";

export const SessionPersonalDevice = (props: { name: string }) => (
  <AlertMessage status="info" title={`${props.name} is offline`} icon={<Monitor />}>
    You can read this conversation. Reconnect {props.name} to continue it.
  </AlertMessage>
);
