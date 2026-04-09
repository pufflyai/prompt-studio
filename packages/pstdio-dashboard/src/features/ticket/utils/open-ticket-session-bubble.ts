interface OpenTicketSessionBubbleInput {
  sessionId: string | null;
  setSessionModalState?: (state: "bubble") => void;
  setSelectedSessionId: (sessionId: string | null) => void;
  forceBubble?: boolean;
}

export const openTicketSessionBubble = (input: OpenTicketSessionBubbleInput) => {
  const { sessionId, setSessionModalState, setSelectedSessionId, forceBubble = false } = input;
  if (!sessionId) return false;

  if (forceBubble && setSessionModalState) {
    setSessionModalState("bubble");
  }
  setSelectedSessionId(sessionId);
  return true;
};
