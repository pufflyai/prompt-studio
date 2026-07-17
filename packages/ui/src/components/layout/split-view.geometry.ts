const FALLBACK_ROOT_SIZE = 1200;
const MIN_COLLAPSE_THRESHOLD_PX = 72;
const MAX_COLLAPSE_THRESHOLD_PX = 160;

export interface SplitPaneGeometry {
  id: string;
  sizePx?: number;
  minSizePx?: number;
  maxSizePx?: number;
}

interface ResolvePaneBoundsInput {
  rootSize: number;
  minSizePx?: number;
  maxSizePx?: number;
  contentMinSizePx?: number;
}

interface RedistributePaneSizesInput {
  rootSize: number;
  deltaPx: number;
  before: SplitPaneGeometry;
  after: SplitPaneGeometry;
}

export const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const resolveRootSize = (rootSize: number) => (rootSize > 0 ? rootSize : FALLBACK_ROOT_SIZE);

export const resolveCollapseThreshold = (minSizePx: number) =>
  clamp(minSizePx / 2, MIN_COLLAPSE_THRESHOLD_PX, MAX_COLLAPSE_THRESHOLD_PX);

export const resolvePaneBounds = (input: ResolvePaneBoundsInput) => {
  const rootSize = resolveRootSize(input.rootSize);
  const maxFromContent = Math.max(0, rootSize - (input.contentMinSizePx ?? 0));
  const configuredMax = input.maxSizePx ?? maxFromContent;
  const maxSize = Math.max(0, Math.min(configuredMax, maxFromContent));
  const minSize = Math.min(input.minSizePx ?? 0, maxSize);

  return { minSize, maxSize };
};

export const resolveReservedPaneSize = (pane: SplitPaneGeometry, currentSize?: number) => {
  const size = currentSize ?? pane.sizePx;
  if (size === undefined) return pane.minSizePx ?? 0;
  return clamp(size, pane.minSizePx ?? 0, pane.maxSizePx ?? Number.POSITIVE_INFINITY);
};

export const redistributePaneSizes = (input: RedistributePaneSizesInput) => {
  const { before, after, deltaPx, rootSize } = input;

  if (before.sizePx !== undefined && after.sizePx === undefined) {
    const bounds = resolvePaneBounds({
      rootSize,
      minSizePx: before.minSizePx,
      maxSizePx: before.maxSizePx,
      contentMinSizePx: after.minSizePx,
    });

    return [{ id: before.id, sizePx: clamp(before.sizePx + deltaPx, bounds.minSize, bounds.maxSize) }];
  }

  if (before.sizePx === undefined && after.sizePx !== undefined) {
    const bounds = resolvePaneBounds({
      rootSize,
      minSizePx: after.minSizePx,
      maxSizePx: after.maxSizePx,
      contentMinSizePx: before.minSizePx,
    });

    return [{ id: after.id, sizePx: clamp(after.sizePx - deltaPx, bounds.minSize, bounds.maxSize) }];
  }

  if (before.sizePx === undefined || after.sizePx === undefined) return [];

  const totalSize = before.sizePx + after.sizePx;
  const beforeBounds = resolvePaneBounds({
    rootSize: totalSize,
    minSizePx: before.minSizePx,
    maxSizePx: before.maxSizePx,
    contentMinSizePx: after.minSizePx,
  });
  const afterBounds = resolvePaneBounds({
    rootSize: totalSize,
    minSizePx: after.minSizePx,
    maxSizePx: after.maxSizePx,
    contentMinSizePx: before.minSizePx,
  });
  const minDelta = Math.max(beforeBounds.minSize - before.sizePx, after.sizePx - afterBounds.maxSize);
  const maxDelta = Math.min(beforeBounds.maxSize - before.sizePx, after.sizePx - afterBounds.minSize);
  const resolvedDelta = clamp(deltaPx, minDelta, maxDelta);

  return [
    { id: before.id, sizePx: before.sizePx + resolvedDelta },
    { id: after.id, sizePx: after.sizePx - resolvedDelta },
  ];
};
