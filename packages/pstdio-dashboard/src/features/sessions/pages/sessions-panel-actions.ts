interface CreateSessionInput {
  projectId?: string;
  prompt: string;
  agent?: string;
  model?: string;
  createSession: (
    input: { projectId: string; prompt: string; agent: string; model?: string },
    options?: { onSuccess?: (result: { sessionId: string }) => void },
  ) => void;
  openSession: (sessionId: string) => void;
}

interface OpenSessionBubbleInput {
  sessionId: string | null;
  setSessionModalState: (state: "bubble") => void;
  setSelectedSessionId: (sessionId: string | null) => void;
  navigateBack: () => void;
}

export const createSessionFromPrompt = (input: CreateSessionInput) => {
  const { projectId, prompt, agent, model, createSession, openSession } = input;
  if (!projectId || !agent) return;

  createSession(
    { projectId, prompt, agent, model },
    {
      onSuccess: ({ sessionId }) => {
        openSession(sessionId);
      },
    },
  );
};

export const openSessionBubbleAndGoBack = (input: OpenSessionBubbleInput) => {
  const { sessionId, setSessionModalState, setSelectedSessionId, navigateBack } = input;
  setSessionModalState("bubble");
  setSelectedSessionId(sessionId);
  navigateBack();
};
