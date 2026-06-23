export const createDataViewQuerySequencer = () => {
  let latestQueryId = 0;

  return {
    next: () => {
      latestQueryId += 1;
      return latestQueryId;
    },
    isLatest: (queryId: number) => queryId === latestQueryId,
  };
};
