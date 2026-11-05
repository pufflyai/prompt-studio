interface ExtensionRefreshRequest {
  generation: number;
  projectId: string;
  queued: boolean;
  applied: boolean;
}

interface CreateExtensionRefreshQueueInput<TValue> {
  apply: (projectId: string, value: TValue) => void;
  onComplete?: (projectId: string) => void;
  fallback: () => TValue;
  getGeneration: () => number;
  getProjectId: () => string | undefined;
  load: (projectId: string) => Promise<TValue>;
}

export const createExtensionRefreshQueue = <TValue>(input: CreateExtensionRefreshQueueInput<TValue>) => {
  let activeRequest: ExtensionRefreshRequest | undefined;
  let hasSuccessfulValue = false;

  const isCurrentRequest = (request: ExtensionRefreshRequest) =>
    request.generation === input.getGeneration() && input.getProjectId() === request.projectId;

  const load = (request: ExtensionRefreshRequest) => {
    void input
      .load(request.projectId)
      .then(
        (value) => {
          if (!isCurrentRequest(request)) return;
          input.apply(request.projectId, value);
          hasSuccessfulValue = true;
          request.applied = true;
        },
        () => {
          if (!isCurrentRequest(request) || hasSuccessfulValue) return;
          input.apply(request.projectId, input.fallback());
          request.applied = true;
        },
      )
      .finally(() => {
        if (activeRequest !== request) return;
        if (request.queued && isCurrentRequest(request)) {
          request.queued = false;
          load(request);
        } else {
          activeRequest = undefined;
          if (request.applied && isCurrentRequest(request)) input.onComplete?.(request.projectId);
        }
      });
  };

  return {
    clear: () => {
      activeRequest = undefined;
      hasSuccessfulValue = false;
    },
    refresh: (projectId: string) => {
      const generation = input.getGeneration();
      if (activeRequest?.projectId === projectId && activeRequest.generation === generation) {
        activeRequest.queued = true;
        return;
      }
      const request = { generation, projectId, queued: false, applied: false };
      activeRequest = request;
      load(request);
    },
  };
};
