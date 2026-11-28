import { ChatMessageListResponse } from "./chat-message-list-items";
import type { ChatMessagePartRange, ChatMessageRow } from "./chat-message-rows";
import type { SessionMessage } from "./message-types";
import { StickyUserMessage } from "./sticky-user-message";

interface ChatMessageRowLayoutProps {
  rowType: ChatMessageRow["type"];
  rowId: string;
  animationKey: string;
  continues: boolean;
  partRange?: ChatMessagePartRange;
  occurrences: number;
  message: SessionMessage;
  index: number;
  start: number;
  height?: number;
  hasGap: boolean;
  measureElement: (element: HTMLDivElement | null) => void;
  expanded: boolean;
  animatedKeys: Set<string>;
  onToggleStickyMessage: (messageId: string) => void;
  streaming: boolean;
  hideQuestionForms: boolean;
  showAssistantActions: boolean;
  onForkMessage?: (messageId: string) => void | Promise<void>;
  forkDisabledReason?: string;
}

// Keep pure row geometry separate from the live virtualizer's ref reads so the compiler can reuse it.
export const ChatMessageRowLayout = (props: ChatMessageRowLayoutProps) => {
  const {
    rowType,
    rowId,
    animationKey,
    continues,
    partRange,
    message,
    index,
    start,
    height,
    hasGap,
    measureElement,
    expanded,
    animatedKeys,
    onToggleStickyMessage,
    streaming,
    hideQuestionForms,
    showAssistantActions,
    onForkMessage,
    forkDisabledReason,
  } = props;
  if (rowType === "user") {
    return (
      <div className="ps-chat-user-row-layout" style={{ top: start, height }}>
        {/* Native sticky layout follows every scroll frame, including within one response. */}
        <div
          className="ps-chat-sticky-row-layout"
          ref={measureElement}
          data-index={index}
          data-chat-message-list-item="user"
          data-chat-message-id={rowId}
          data-chat-row-key={rowId}
          data-chat-row-gap={hasGap ? "" : undefined}
        >
          <StickyUserMessage
            message={message}
            occurrences={props.occurrences}
            expanded={expanded}
            animatedKeys={animatedKeys}
            onToggle={onToggleStickyMessage}
          />
        </div>
      </div>
    );
  }
  return (
    <div
      className="ps-chat-response-row-layout"
      ref={measureElement}
      data-index={index}
      data-chat-message-list-item={rowType}
      data-chat-message-id={continues ? undefined : message.id}
      data-chat-row-key={rowId}
      data-chat-row-continues={continues ? "" : undefined}
      data-chat-row-gap={hasGap ? "" : undefined}
      style={{ top: start }}
    >
      <ChatMessageListResponse
        message={message}
        animationKey={animationKey}
        continues={continues}
        partRange={partRange}
        occurrences={props.occurrences}
        streaming={streaming}
        hideQuestionForms={hideQuestionForms}
        animatedKeys={animatedKeys}
        showAssistantActions={showAssistantActions}
        onForkMessage={onForkMessage}
        forkDisabledReason={forkDisabledReason}
      />
    </div>
  );
};
