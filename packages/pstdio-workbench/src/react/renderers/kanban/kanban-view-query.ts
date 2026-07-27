export const createKanbanViewQuerySequencer = () => {
  let latestQueryId = 0;

  return {
    next: () => {
      latestQueryId += 1;
      return latestQueryId;
    },
    isLatest: (queryId: number) => queryId === latestQueryId,
  };
};

export const executeKanbanViewQuery = async <TRow>(executeQuery: () => Promise<TRow[]> | TRow[]) => {
  try {
    return await executeQuery();
  } catch {
    return [];
  }
};
