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
      .catch(() => input.fallback)
      .then((value) => {
        if (request.generation !== input.getGeneration() || input.getProjectId() !== request.projectId) return;
        input.apply(request.projectId, value);
      })
      .finally(() => {
        if (activeRequest !== request) return;
        activeRequest = undefined;
        if (request.queued && input.getProjectId() === request.projectId) refresh(request.projectId);
      });
  };

  return {
    clear: () => {
      activeRequest = undefined;
    },
    refresh,
  };
};
