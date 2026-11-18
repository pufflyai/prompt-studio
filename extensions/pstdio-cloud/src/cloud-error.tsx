import { AlertMessage } from "@pstdio/ui";
import { type ReactNode, useState } from "react";

export const CloudError = (props: { message: string; action?: ReactNode; onClose?: () => void }) => {
  const { message, action, onClose } = props;
  const [dismissed, setDismissed] = useState<string>();
  if (message === dismissed) return null;
  return (
    <AlertMessage
      size="sm"
      status="error"
      role="alert"
      position="absolute"
      bottom="xs"
      insetInline="xs"
      zIndex="docked"
      title={message}
      onClose={onClose ?? (() => setDismissed(message))}
      endElement={action}
    />
  );
};
