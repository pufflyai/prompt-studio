import { Button } from "@chakra-ui/react";
import { AlertMessage } from "@pstdio/ui";

interface RendererReadNoticeProps {
  error: string;
  retry(): void;
}

export const RendererReadNotice = (props: RendererReadNoticeProps) => {
  const { error, retry } = props;
  return (
    <AlertMessage
      status="error"
      title="Could not load this view"
      endElement={
        <Button size="xs" variant="outline" onClick={retry}>
          Retry
        </Button>
      }
    >
      {error}
    </AlertMessage>
  );
};
