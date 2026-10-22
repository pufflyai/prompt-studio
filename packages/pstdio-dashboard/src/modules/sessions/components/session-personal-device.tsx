import { AlertMessage } from "@pstdio/ui";
import { Monitor } from "lucide-react";

export const SessionPersonalDevice = (props: { name: string }) => {
  const { name } = props;
  return (
    <AlertMessage status="info" title={`Session on ${name}`} icon={<Monitor />}>
      You can read this conversation here. Continue it on its device.
    </AlertMessage>
  );
};
