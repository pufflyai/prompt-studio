import { Box, useSlotRecipe } from "@chakra-ui/react";
import { useLayoutEffect, useRef, useState, type WheelEvent } from "react";
import { ScrollArea } from "@/components/primitives/scroll-area";
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
  const viewportRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const [collapsible, setCollapsible] = useState(false);
  const isExpanded = collapsible && expanded;
  const recipe = useSlotRecipe({ key: "stickyUserMessage" });
  const styles = recipe({ expanded: isExpanded });
  const viewportProps = {
    css: styles.viewport,
    "data-sticky-user-message-content": isExpanded ? "expanded" : "collapsed",
    onWheel: isExpanded ? handleWheel : undefined,
  };

  useLayoutEffect(() => {
    const body = bodyRef.current!;
    const preview = previewRef.current!;
    const measure = () => {
      setCollapsible(body.getBoundingClientRect().height > preview.getBoundingClientRect().height + 1);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(body);
    observer.observe(preview);
    measure();
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    if (!isExpanded) viewportRef.current!.scrollTop = 0;
  }, [isExpanded]);

  const actions = <MessageActionPanel message={message} alwaysVisible copyAlwaysVisible={false} />;
  return (
    <ChatMessage.Root from="user" delivery={message.delivery ?? "sent"} {...(animate ? messageFadeInProps : undefined)}>
      <ChatMessage.Content from="user" css={styles.root}>
        <Box ref={previewRef} css={styles.preview} aria-hidden="true" />
        <ScrollArea viewportRef={viewportRef} showVerticalScrollbar={isExpanded} viewportProps={viewportProps}>
          <Box ref={bodyRef} css={styles.body}>
            <MessagePartsRenderer message={message} />
          </Box>
        </ScrollArea>
        {!collapsible ? <Box css={styles.actions}>{actions}</Box> : null}
        {collapsible ? (
          <StickyMessageToggle
            expanded={isExpanded}
            label={isExpanded ? "Show less" : "Show more"}
            onClick={() => onToggle(message.id)}
            actionPanel={actions}
          />
        ) : null}
      </ChatMessage.Content>
    </ChatMessage.Root>
  );
}
