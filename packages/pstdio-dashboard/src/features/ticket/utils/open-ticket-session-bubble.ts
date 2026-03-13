interface OpenTicketSessionBubbleInput {
  sessionId: string | null;
  setSessionModalState: (state: "bubble") => void;
  setSelectedSessionId: (sessionId: string | null) => void;
}

export const openTicketSessionBubble = (input: OpenTicketSessionBubbleInput) => {
  const { sessionId, setSessionModalState, setSelectedSessionId } = input;
  if (!sessionId) return false;

  setSessionModalState("bubble");
  setSelectedSessionId(sessionId);
  return true;
};
