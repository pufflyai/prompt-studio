import { Button } from "@chakra-ui/react";
import { ActionErrorSlot, AlertMessage } from "@pstdio/ui";

interface RendererReadNoticeProps {
  error: string;
  retry(): void;
}

export const RendererReadNotice = (props: RendererReadNoticeProps) => {
  const { error, retry } = props;
  return (
    <ActionErrorSlot>
      <AlertMessage
        compact
        status="error"
        title="Could not load this view"
        endElement={<Button onClick={retry}>Retry</Button>}
      >
        {error}
      </AlertMessage>
    </ActionErrorSlot>
  );
};
