import { SessionChatView } from "@/features/sessions/components/session-chat-view";

interface SessionChatProps {
  sessionId: string | null;
}

export const SessionChat = (props: SessionChatProps) => {
  const { sessionId } = props;

  return <SessionChatView sessionId={sessionId} />;
};
