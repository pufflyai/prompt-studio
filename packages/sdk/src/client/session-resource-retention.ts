import type { createSessionStreamTransport } from "./session-stream";
import { isSessionStreamRejection } from "./session-stream-errors";

export const retainSessionResources = (streams: ReturnType<typeof createSessionStreamTransport>, sessionId: string) => {
  let closed = false;
  let connection: { close(): void } | undefined;
  let retry: ReturnType<typeof setTimeout> | undefined;
  const connect = () => {
    connection = streams.subscribe(
      { retain_session_id: sessionId },
      {
        onEvent: () => {},
        // A dropped client stream releases the host's interest. Restore that
        // interest when the connection returns, even if the tab never changes.
        onError: (error) => {
          if (!closed && !isSessionStreamRejection(error)) retry = setTimeout(connect, 1000);
        },
      },
    );
  };
  connect();
  return {
    close: () => {
      closed = true;
      clearTimeout(retry);
      connection?.close();
    },
  };
};
