import type { Diff } from "./diff-card";
import { DiffCardBody } from "./diff-card-body";
import { DeferredDiffLoad, LoadingDiffContent } from "./diff-card-load-state";

interface DiffCardContentProps {
  diff: Diff;
  filePath: string;
  oldContent: string;
  newContent: string;
  isExpanded: boolean;
  isLargeDiff: boolean;
  isGeneratedDiff: boolean;
  hasDiffContent: boolean;
  canLoadDiff: boolean;
  shouldAutoLoadDiff: boolean;
  loadError: boolean;
  isLoadingDiff: boolean;
  onLoadDiff: () => Promise<void>;
  hasOptedIntoLargeDiff: boolean;
  onShowFullDiff?: () => void;
}

interface DeferredDiffLoadStateInput {
  isLargeDiff: boolean;
  isGeneratedDiff: boolean;
  loadError: boolean;
  canLoadDiff: boolean;
  onLoadDiff: () => Promise<void>;
  onShowFullDiff?: () => void;
}

const buildDeferredDiffLoadState = (input: DeferredDiffLoadStateInput) => {
  const { isLargeDiff, isGeneratedDiff, loadError, canLoadDiff, onLoadDiff, onShowFullDiff } = input;
  let title = "Diff content is not loaded yet.";
  let actionLabel = canLoadDiff ? "Load diff" : undefined;
  let onAction: (() => void) | undefined = canLoadDiff ? () => void onLoadDiff() : undefined;

  if (isLargeDiff) {
    title = "Large diffs are hidden by default";
    actionLabel = canLoadDiff ? "Show full diff" : undefined;
    onAction = () => {
      onShowFullDiff?.();
      void onLoadDiff();
    };
  }

  if (isGeneratedDiff) {
    title = "Generated diffs are hidden by default";
    actionLabel = canLoadDiff ? "Load diff" : undefined;
    onAction = canLoadDiff ? () => void onLoadDiff() : undefined;
  }

  if (loadError) {
    title = "Diff failed to load. Try again.";
    actionLabel = canLoadDiff ? "Load diff" : undefined;
    onAction = canLoadDiff ? () => void onLoadDiff() : undefined;
  }

  return { title, actionLabel, onAction };
};

export const DiffCardContent = (props: DiffCardContentProps) => {
  const {
    diff,
    filePath,
    oldContent,
    newContent,
    isExpanded,
    isLargeDiff,
    isGeneratedDiff,
    hasDiffContent,
    canLoadDiff,
    shouldAutoLoadDiff,
    loadError,
    isLoadingDiff,
    onLoadDiff,
    hasOptedIntoLargeDiff,
    onShowFullDiff,
  } = props;

  if (!isExpanded) return null;

  if (!hasDiffContent && !shouldAutoLoadDiff) {
    const { title, actionLabel, onAction } = buildDeferredDiffLoadState({
      isLargeDiff,
      isGeneratedDiff,
      loadError,
      canLoadDiff,
      onLoadDiff,
      onShowFullDiff,
    });

    return (
      <DeferredDiffLoad title={title} actionLabel={actionLabel} isLoadingDiff={isLoadingDiff} onAction={onAction} />
    );
  }

  if (shouldAutoLoadDiff) {
    return <LoadingDiffContent />;
  }

  return (
    <DiffCardBody
      diff={diff}
      filePath={filePath}
      oldContent={oldContent}
      newContent={newContent}
      isLargeDiff={isLargeDiff}
      hasOptedIntoLargeDiff={hasOptedIntoLargeDiff}
      onShowFullDiff={onShowFullDiff}
    />
  );
};
