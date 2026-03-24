interface OpenSessionBubbleInput {
  sessionId: string | null;
  setSessionModalState: (state: "bubble") => void;
  setSelectedSessionId: (sessionId: string | null) => void;
  navigateBack: () => void;
}

export const openSessionBubbleAndGoBack = (input: OpenSessionBubbleInput) => {
  const { sessionId, setSessionModalState, setSelectedSessionId, navigateBack } = input;
  setSessionModalState("bubble");
  setSelectedSessionId(sessionId);
  navigateBack();
};
