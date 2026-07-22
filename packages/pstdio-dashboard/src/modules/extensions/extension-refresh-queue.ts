interface ExtensionRefreshRequest {
  generation: number;
  projectId: string;
  queued: boolean;
}

interface CreateExtensionRefreshQueueInput<TValue> {
  apply: (projectId: string, value: TValue) => void;
  fallback: TValue;
  getGeneration: () => number;
  getProjectId: () => string | undefined;
  load: (projectId: string) => Promise<TValue>;
}

export const createExtensionRefreshQueue = <TValue>(input: CreateExtensionRefreshQueueInput<TValue>) => {
  let activeRequest: ExtensionRefreshRequest | undefined;
  let hasSuccessfulValue = false;

  const isCurrentRequest = (request: ExtensionRefreshRequest) =>
    request.generation === input.getGeneration() && input.getProjectId() === request.projectId;

  const refresh = (projectId: string) => {
    const generation = input.getGeneration();
    if (activeRequest?.projectId === projectId && activeRequest.generation === generation) {
      activeRequest.queued = true;
      return;
    }

    const request: ExtensionRefreshRequest = { generation, projectId, queued: false };
    activeRequest = request;
    void input
      .load(projectId)
      .then(
        (value) => {
          if (!isCurrentRequest(request)) return;
          hasSuccessfulValue = true;
          input.apply(request.projectId, value);
        },
        () => {
          if (!isCurrentRequest(request) || hasSuccessfulValue) return;
          input.apply(request.projectId, input.fallback);
        },
      )
      .finally(() => {
        if (activeRequest !== request) return;
        activeRequest = undefined;
        if (request.queued && input.getProjectId() === request.projectId) refresh(request.projectId);
      });
  };

  return {
    clear: () => {
      activeRequest = undefined;
      hasSuccessfulValue = false;
    },
    refresh,
  };
};
