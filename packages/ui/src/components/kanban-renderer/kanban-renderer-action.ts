export type KanbanActionErrorHandler = (error: unknown, action: string) => void;

export const runKanbanAction = async (action: string, run: () => unknown, onError?: KanbanActionErrorHandler) => {
  try {
    await run();
  } catch (error) {
    if (!onError) throw error;
    onError(error, action);
  }
};
