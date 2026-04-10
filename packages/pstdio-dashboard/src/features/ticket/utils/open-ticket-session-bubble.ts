import type { SessionModalState } from "@/features/project-settings/store/types";

interface OpenTicketSessionBubbleInput {
  sessionId: string | null;
  sessionModalState?: SessionModalState;
  setSessionModalState?: (state: "bubble") => void;
  setSelectedSessionId: (sessionId: string | null) => void;
}

export const openTicketSessionBubble = (input: OpenTicketSessionBubbleInput) => {
  const { sessionId, sessionModalState, setSessionModalState, setSelectedSessionId } = input;
  if (!sessionId) return false;

  if (sessionModalState === "closed" && setSessionModalState) {
    setSessionModalState("bubble");
  }
  setSelectedSessionId(sessionId);
  return true;
};
