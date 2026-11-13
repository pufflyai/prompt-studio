import { Button, SkeletonText } from "@chakra-ui/react";
import { type ComponentType, useEffect, useState } from "react";
import { AlertMessage } from "@/components/primitives/alert";
import { installPrismGlobal } from "@/utils/prism";
import type { RichMessageProps } from "./rich-message/rich-message";

type MessageLoadState =
  | { kind: "loading" }
  | { kind: "ready"; Message: ComponentType<RichMessageProps> }
  | { kind: "failed" };

// Keep the UI entry lightweight and initialize Prism before Lexical evaluates.
export const LazyRichMessage = (props: RichMessageProps) => {
  const [state, setState] = useState<MessageLoadState>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await installPrismGlobal();
        const module = await import("./rich-message/rich-message");
        if (!cancelled) setState({ kind: "ready", Message: module.RichMessage });
      } catch {
        if (!cancelled) setState({ kind: "failed" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.kind === "ready") {
    const { Message } = state;
    return <Message {...props} />;
  }
  if (state.kind === "failed") {
    return (
      <AlertMessage
        status="error"
        title="Could not load the message"
        endElement={<Button onClick={() => window.location.reload()}>Reload</Button>}
      />
    );
  }
  return <SkeletonText variant="none" noOfLines={2} role="status" aria-label="Loading message" />;
};
