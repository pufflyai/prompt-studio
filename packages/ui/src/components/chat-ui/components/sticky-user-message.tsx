import { Box, useSlotRecipe } from "@chakra-ui/react";
import { useLayoutEffect, useRef, useState, type WheelEvent } from "react";
import { ChatMessage } from "./ai-message";
import { messageFadeInProps } from "./chat-message-animation";
import { StickyMessageToggle } from "./chat-message-list-items";
import { shouldStopStickyUserMessageWheel } from "./chat-panel-sticky-user-message";
import { MessageActionPanel } from "./message-action-panel";
import { MessagePartsRenderer } from "./message-parts-renderer";
import type { SessionMessage } from "./message-types";

interface StickyUserMessageProps {
  message: SessionMessage;
  expanded: boolean;
  animate: boolean;
  onToggle: (messageId: string) => void;
}

const handleWheel = (event: WheelEvent<HTMLElement>) => {
  if (shouldStopStickyUserMessageWheel(event.currentTarget, event.deltaY)) event.stopPropagation();
};

export function StickyUserMessage(props: StickyUserMessageProps) {
  const { message, expanded, animate, onToggle } = props;
  const bodyRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const [collapsible, setCollapsible] = useState(false);
  const isExpanded = collapsible && expanded;
  const recipe = useSlotRecipe({ key: "stickyUserMessage" });
  const styles = recipe({ expanded: isExpanded });

  useLayoutEffect(() => {
    const body = bodyRef.current!;
    const preview = previewRef.current!;
    const measure = () => {
      // Expanded padding reserves space for the overlay, so measure the message itself.
      const bodyStyle = getComputedStyle(body);
      const contentHeight = body.getBoundingClientRect().height - parseFloat(bodyStyle.paddingBottom);
      const previewHeight = preview.getBoundingClientRect().height - parseFloat(bodyStyle.paddingTop);
      setCollapsible(contentHeight > previewHeight + 1);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(body);
    observer.observe(preview);
    measure();
    return () => observer.disconnect();
  }, []);

  const actions = <MessageActionPanel message={message} alwaysVisible copyAlwaysVisible={false} />;
  return (
    <ChatMessage.Root from="user" delivery={message.delivery ?? "sent"} {...(animate ? messageFadeInProps : undefined)}>
      <ChatMessage.Content from="user" css={styles.root}>
        <Box ref={previewRef} css={styles.preview} aria-hidden="true" />
        <Box
          css={styles.viewport}
          data-sticky-user-message-content={isExpanded ? "expanded" : "collapsed"}
          onWheel={isExpanded ? handleWheel : undefined}
        >
          <Box ref={bodyRef} css={styles.body}>
            <MessagePartsRenderer message={message} />
          </Box>
        </Box>
        {!collapsible ? <Box css={styles.actions}>{actions}</Box> : null}
        {collapsible ? (
          <StickyMessageToggle
            label={isExpanded ? "Show less" : "Show more"}
            onClick={() => onToggle(message.id)}
            actionPanel={actions}
          />
        ) : null}
      </ChatMessage.Content>
    </ChatMessage.Root>
  );
}
