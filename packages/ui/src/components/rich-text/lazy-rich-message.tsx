import { Button, SkeletonText } from "@chakra-ui/react";
import { lazy, Suspense } from "react";
import { AlertMessage } from "@/components/primitives/alert";
import { ErrorBoundary } from "@/components/primitives/error-boundary";
import { installPrismGlobal } from "@/utils/prism";
import type { RichMessageProps } from "./rich-message/rich-message";

// Keep the UI entry lightweight and initialize Prism before Lexical evaluates.
// A shared lazy type also renders later history rows without a loading-height change.
const Message = lazy(async () => {
  await installPrismGlobal();
  return { default: (await import("./rich-message/rich-message")).RichMessage };
});

export const LazyRichMessage = (props: RichMessageProps) => (
  <ErrorBoundary
    fallback={
      <AlertMessage
        status="error"
        title="Could not load the message"
        endElement={<Button onClick={() => window.location.reload()}>Reload</Button>}
      />
    }
  >
    <Suspense fallback={<SkeletonText variant="none" noOfLines={2} role="status" aria-label="Loading message" />}>
      <Message {...props} />
    </Suspense>
  </ErrorBoundary>
);
