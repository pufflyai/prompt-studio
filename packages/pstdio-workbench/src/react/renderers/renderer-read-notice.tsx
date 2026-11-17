import { Button } from "@chakra-ui/react";
import { ActionErrorSlot, AlertMessage, ReadErrorRecovery } from "@pstdio/ui";

interface RendererReadNoticeProps {
  error: string;
  initial?: boolean;
  retry(): void;
}

export const RendererReadNotice = (props: RendererReadNoticeProps) => {
  const { error, retry, initial } = props;
  if (initial) return <ReadErrorRecovery error={error} title="Could not load this view" retry={retry} />;
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
