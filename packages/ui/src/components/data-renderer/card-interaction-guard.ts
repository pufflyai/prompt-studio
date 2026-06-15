const suppressionKey = "__pstdioDataRendererCardClickSuppressionUntil";

type DataRendererCardInteractionGlobal = typeof globalThis & {
  [suppressionKey]?: number;
};

const getInteractionGlobal = () => globalThis as DataRendererCardInteractionGlobal;

export const suppressNextDataRendererCardClick = () => {
  getInteractionGlobal()[suppressionKey] = Date.now() + 1500;
};

export const isDataRendererCardClickSuppressed = () => Date.now() <= (getInteractionGlobal()[suppressionKey] ?? 0);
