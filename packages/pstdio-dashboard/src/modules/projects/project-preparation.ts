interface ProjectPreparationInput {
  selected(): string | undefined;
  ready(projectId: string): boolean;
  status(projectId: string): Promise<{ state: string; offlineReady: boolean }>;
  open(projectId: string): Promise<unknown>;
  failed(error: unknown): void;
}

export const createProjectPreparation = (input: ProjectPreparationInput) => {
  let disposed = false;
  const pending = new Map<string, { dirty: boolean; work: Promise<void> }>();
  return {
    refresh() {
      const projectId = input.selected();
      if (disposed || !projectId || input.ready(projectId)) return Promise.resolve();
      const existing = pending.get(projectId);
      if (existing) {
        existing.dirty = true;
        return existing.work;
      }
      const current = () => !disposed && input.selected() === projectId;
      const request = { dirty: false, work: Promise.resolve() };
      const run = async () => {
        do {
          request.dirty = false;
          const status = await input.status(projectId).catch((error: unknown) => {
            if (request.dirty && current()) return undefined;
            throw error;
          });
          if (!current() || input.ready(projectId)) return;
          if (!status) continue;
          if (status.state === "local" || status.offlineReady) {
            await input.open(projectId);
            return;
          }
        } while (request.dirty && current());
      };
      pending.set(projectId, request);
      request.work = run()
        .catch((error) => {
          if (current()) input.failed(error);
        })
        .finally(() => pending.delete(projectId));
      return request.work;
    },
    dispose() {
      disposed = true;
    },
  };
};
