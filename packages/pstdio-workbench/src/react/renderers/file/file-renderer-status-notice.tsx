import type { FileEditControllerState } from "./file-renderer-edit-state";
import { FileRendererErrorNotice } from "./file-renderer-error-notice";

interface FileRendererStatusNoticeProps {
  state: FileEditControllerState;
  loadError: string | undefined;
  retryRead: () => void;
  retrySave: () => void;
}

export const FileRendererStatusNotice = (props: FileRendererStatusNoticeProps) => {
  const { state, loadError, retryRead, retrySave } = props;
  if (state.removed)
    return (
      <FileRendererErrorNotice message="This resource was removed. Your draft is kept here. Copy it before closing this tab." />
    );
  if (loadError) return <FileRendererErrorNotice message={loadError} onRetry={retryRead} />;
  if (state.saveError) return <FileRendererErrorNotice message={state.saveError} onRetry={retrySave} />;
  return null;
};
